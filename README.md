# mhxx-charm-watcher

欲しい護石を登録しておき、今のフレームから近いうちに狙えるものを
見張るブラウザ向けのツール (ベータ版)。

**公開ページ**: <https://skst328.github.io/mhxx-charm-watcher/>

## 使い方

1. 「登録」のタブで、第 1 スキルと第 2 スキルを選び、欲しい護石を
   登録する。有名な理論値護石をまとめて登録するボタンもある
2. 「ウォッチ」のタブに現在フレームを入れ、「更新」を押す。
   登録した護石ごとに最短の当たりフレームまでの時間が出てくる。
3. 欲しい護石が手に入ったら、カードの王冠を押して所持済みにする
   (ウォッチ対象から外れる)

現在フレームが分からないときは、「クエスト報酬から推定」を使う。
クエスト報酬で鑑定した護石を 1 個目から順に入れて探し、候補を選ぶと
現在フレームの欄に入る。
(この方法で特定したフレームは「鑑定する」ボタンを押した瞬間のフレーム)

## 開発

```sh
pnpm install

# 乱数の検索 (Rust → WebAssembly)
# watcher-core/pkg を作る
# Rust を変えたら打ち直す
cd watcher-core
wasm-pack build --target web
cd ..

pnpm dev

# テスト (src/lib の *.test.ts)
pnpm test
```

## ライセンス

MIT License です。全文は [LICENSE](LICENSE) を参照してください。

### 使用しているソフトウェア

配布物に含まれるものと、そのライセンスです。

| | ライセンス | 用途 |
|---|---|---|
| [React](https://react.dev/) | MIT | 画面 |
| [Base UI](https://base-ui.com/) | MIT | UI 部品の土台 |
| [shadcn/ui](https://ui.shadcn.com/) | MIT | UI 部品 |
| [Tailwind CSS](https://tailwindcss.com/) / tw-animate-css | MIT | スタイル |
| [class-variance-authority](https://cva.style/) | Apache-2.0 | スタイルの切り替え |
| [Lucide](https://lucide.dev/) | ISC | アイコン |
| [Geist](https://vercel.com/font) | **OFL-1.1** | フォント |
| [wasm-bindgen](https://github.com/wasm-bindgen/wasm-bindgen) / serde / [tsify](https://github.com/madonoharu/tsify) ほか | MIT または Apache-2.0 | Rust から WebAssembly への橋渡し |
| [mhxx-rand](https://github.com/skst328/mhxx-rand) | MIT | 乱数と護石の決まり方 (護石の検索) |

**Geist** は SIL Open Font License 1.1 です。ライセンス全文は
<https://github.com/vercel/geist-font> に含まれています。

**乱数と護石の決まり方** は mhxx-rand を使っています。mhxx-rand は
apmnnn 氏の [mhxx-rng](https://github.com/apmnnn/mhxx-rng) (MIT) の移植で、
mhxx-rng の MIT ライセンスの全文は mhxx-rand の `rand-core/src/rng.rs` の冒頭に
記載されています。
