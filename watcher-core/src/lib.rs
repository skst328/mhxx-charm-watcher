//! ブラウザ (TypeScript) から呼ぶ入口。乱数と護石は mhxx-rand に任せ、結果を JS のオブジェクトに変えるだけ。
//! 投入する素材のランクは最高ランク (4) に決めてある

pub mod types;

use std::collections::BTreeMap;

use mhxx_rand as rand;
use wasm_bindgen::prelude::*;

use types::{Charm, Compare, Found, Kind, Melding, PointRange, RewardCharm, SkillInfo};

/// number で受けたフレームを u64 に直す (0 以上の整数でなければエラー)
fn frame(v: f64) -> Result<u64, JsError> {
    if v >= 0.0 && v.fract() == 0.0 && v <= 2f64.powi(53) {
        Ok(v as u64)
    } else {
        Err(JsError::new(&format!("フレームは 0 以上の整数: {v}")))
    }
}

/// JS の値に変える。None は undefined ではなく null にする (d.ts の `T | null` と揃える)
fn to_js<T: serde::Serialize>(v: &T) -> Result<JsValue, JsError> {
    Ok(v.serialize(&serde_wasm_bindgen::Serializer::new().serialize_missing_as_null(true))?)
}

/// 出ない護石のエラーを、画面に出す文にする。1 行目は見出し (title)、2 行目から種類ごとの理由
fn impossible_message(
    charm: &rand::Charm,
    reasons: &[(rand::Kind, rand::Reason)],
    title: &str,
) -> String {
    let s1 = charm.skill1.full_name();
    let lines = reasons.iter().map(|&(kind, reason)| {
        let name = match kind {
            rand::Kind::Weathered => "風化したお守り",
            rand::Kind::Worn => "古びたお守り",
            rand::Kind::Shining => "光るお守り",
            rand::Kind::Mystery => "なぞのお守り",
        };
        let (s2, p2) = charm.skill2.map_or(("", 0), |(s, p)| (s.full_name(), p));
        let why = match reason {
            rand::Reason::Skill1 => format!("{s1}が第1スキルにならない"),
            rand::Reason::Pts1 => format!("第1スキルに{s1}{}が出ない", charm.pts1),
            // なぞのお守りには第 2 スキルがそもそも付かない
            rand::Reason::Skill2 if kind == rand::Kind::Mystery => {
                "第2スキルが付かない".to_string()
            }
            rand::Reason::Skill2 => format!("{s2}が第2スキルにならない"),
            rand::Reason::Pts2 => format!("第2スキルに{s2}{p2}が出ない"),
            rand::Reason::SameSkill => "第1スキルと第2スキルが同じ".to_string(),
            rand::Reason::Slots => format!("スロット{}は出ない", charm.slots),
            rand::Reason::NotInMelding => "この錬金では出ない".to_string(),
        };
        format!("{name}: {why}")
    });
    std::iter::once(title.to_string())
        .chain(lines)
        .collect::<Vec<_>>()
        .join("\n")
}

/// melding で出うるスキル (番号の小さい順) と、第 1・第 2 スキルとしてのポイントの範囲
#[wasm_bindgen(js_name = skillInfo, unchecked_return_type = "SkillInfo[]")]
pub fn skill_info(
    #[wasm_bindgen(unchecked_param_type = "Melding")] melding: JsValue,
) -> Result<JsValue, JsError> {
    let melding: Melding = serde_wasm_bindgen::from_value(melding)?;
    let info: Vec<SkillInfo> = rand::skill_info(melding.into())
        .iter()
        .map(SkillInfo::from)
        .collect();
    to_js(&info)
}

/// クエスト報酬で kind のお守りから出うるスキル (番号の小さい順) と、第 1・第 2 スキルとしてのポイントの範囲。
/// 第 2 スキルはマイナスも含む (0 は画面に出ないが、範囲には含める。選択肢から外すのは呼ぶ側)。
/// なぞのお守りには第 2 スキルが付かないので、第 2 スキルの範囲はどれも null
#[wasm_bindgen(js_name = rewardSkillInfo, unchecked_return_type = "SkillInfo[]")]
pub fn reward_skill_info(
    #[wasm_bindgen(unchecked_param_type = "Kind")] kind: JsValue,
) -> Result<JsValue, JsError> {
    let kind: rand::Kind = serde_wasm_bindgen::from_value::<Kind>(kind)?.into();
    let t = kind.table();
    // スキルの番号の小さい順に並べる
    let mut info: BTreeMap<u16, SkillInfo> = BTreeMap::new();
    for (&s, &(lo, hi)) in t.skill1.iter().zip(t.pts1) {
        info.entry(s.id()).or_insert_with(|| new_info(s)).pts1 = Some(PointRange {
            min: lo as i8,
            max: hi as i8,
        });
    }
    if t.no_skill2 < 100 {
        for (&s, &(minus, max)) in t.skill2.iter().zip(t.pts2) {
            info.entry(s.id()).or_insert_with(|| new_info(s)).pts2 = Some(PointRange {
                min: -(minus as i8),
                max: max as i8,
            });
        }
    }
    to_js(&info.into_values().collect::<Vec<_>>())
}

/// ポイントの範囲がまだ無い、スキルの情報
fn new_info(s: rand::Skill) -> SkillInfo {
    SkillInfo {
        id: s.id(),
        name: s.full_name(),
        abbr: s.name(),
        pts1: None,
        pts2: None,
    }
}

/// 位置 [start, end) で「鑑定する」を押すと、クエスト報酬で鑑定した charms が 1 個目から順に出るフレームを返す
/// (小さい順に limit 件まで)。レア度が 1〜10 でなければエラー
#[wasm_bindgen(js_name = searchRewards, unchecked_return_type = "number[]")]
pub fn search_rewards(
    #[wasm_bindgen(unchecked_param_type = "RewardCharm[]")] charms: JsValue,
    start: f64,
    end: f64,
    limit: u32,
) -> Result<JsValue, JsError> {
    let charms = serde_wasm_bindgen::from_value::<Vec<RewardCharm>>(charms)?
        .into_iter()
        .map(rand::RewardCharm::try_from)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| JsError::new(&e))?;
    let frames = rand::search_rewards(&charms, frame(start)?..frame(end)?)
        .map_err(|e| JsError::new(&e.to_string()))?;
    let frames: Vec<f64> = frames
        .into_iter()
        .take(limit as usize)
        .map(|f| f as f64)
        .collect();
    to_js(&frames)
}

/// 位置 [start, end) で、compare の比べ方で charms のどれかに合う護石が、kinds のどれかの種類のお守りとして
/// 作られる位置を探し、錬金のフレームと一緒に返す (位置の小さい順)。
/// charms と kinds の組のうち出ないものは飛ばし、どれも出なければエラー (第 1 スキルを問わないときに、
/// 呼ぶ側が第 1 スキルごとの条件を並べて渡す)。エラーの文は画面にそのまま出せる日本語で、charms が 1 つなら
/// 種類ごとの理由も改行で区切って付ける (候補が多いと長くなりすぎるので)。
/// 範囲で区切って呼べるので、進み具合の表示は呼ぶ側が範囲を刻む。
/// 返すのは位置の小さいほうから limit 件まで (条件がゆるいと何十万件も当たり、JS に渡すのが重いので)
#[wasm_bindgen(unchecked_return_type = "Found[]")]
pub fn search(
    #[wasm_bindgen(unchecked_param_type = "Melding")] melding: JsValue,
    #[wasm_bindgen(unchecked_param_type = "Charm[]")] charms: JsValue,
    #[wasm_bindgen(unchecked_param_type = "Kind[]")] kinds: JsValue,
    #[wasm_bindgen(unchecked_param_type = "Compare")] compare: JsValue,
    start: f64,
    end: f64,
    limit: u32,
) -> Result<JsValue, JsError> {
    let melding: rand::Melding = serde_wasm_bindgen::from_value::<Melding>(melding)?.into();
    let charms: Vec<Charm> = serde_wasm_bindgen::from_value(charms)?;
    let kinds: Vec<rand::Kind> = serde_wasm_bindgen::from_value::<Vec<Kind>>(kinds)?
        .into_iter()
        .map(Into::into)
        .collect();
    let compare: rand::Compare = serde_wasm_bindgen::from_value::<Compare>(compare)?.into();
    let detail = charms.len() == 1;
    let mut queries = Vec::new();
    // 出なかった組の、種類ごとの理由 (charms が 1 つのときだけ使う)
    let mut reasons = Vec::new();
    let mut last = None;
    for charm in charms {
        let charm = rand::Charm::try_from(charm).map_err(|e| JsError::new(&e))?;
        for &kind in &kinds {
            match rand::Query::new(melding, rand::Rank::MAX, Some(kind), &charm, compare) {
                Ok(q) => queries.push(q),
                Err(rand::QueryError::Impossible(r)) => reasons.extend(r),
            }
        }
        last = Some(charm);
    }
    if queries.is_empty() {
        let title = if kinds.len() == melding.kinds().len() {
            "この錬金では出ない組み合わせ"
        } else {
            "選んだ種類では出ない組み合わせ"
        };
        let message = match last {
            Some(charm) if detail => impossible_message(&charm, &reasons, title),
            Some(_) => title.to_string(),
            None => "探す護石がない".to_string(),
        };
        return Err(JsError::new(&message));
    }
    let found: Vec<Found> = rand::search_many(&queries, frame(start)?..frame(end)?)
        .iter()
        .take(limit as usize)
        .map(Found::from)
        .collect();
    to_js(&found)
}
