# 動画を Git で扱う方法

大きい動画はそのままコミットせず、以下のどちらかで運用します。

## 1) 推奨: Git LFS を使う

```bash
git lfs install
git lfs track "assets/*.mp4" "assets/*.mov"
git add .gitattributes
```

- 分割復元の手間がなく、通常の動画ファイルとして扱えます。
- ただし Git LFS の容量上限は契約プランに依存します。

## 2) 通常 Git だけで運用する (圧縮 + 分割)

### 手順

1. 元動画を `assets/source/` に置く（`.gitignore` 対象）
2. 圧縮 + 分割を実行

```bash
./scripts/prepare_video_for_git.sh "assets/source/your_video.mov" your_video
```

3. 生成された `assets/git-ready/chunks/your_video.part-***` をコミット
4. 利用時に復元

```bash
./scripts/restore_split_video.sh assets/git-ready/chunks/your_video.part- assets/your_video.mp4
```

5. `assets/playlist.json` に復元後ファイル名を登録

## 生成物

- 圧縮動画: `assets/git-ready/<name>.mp4`
- 分割片: `assets/git-ready/chunks/<name>.part-000` ...

分割サイズは 95MB 固定なので、GitHub の 100MB 上限回避に使えます。
