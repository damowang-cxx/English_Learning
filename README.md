# English Learning

一个面向英语学习训练的 Next.js 应用，当前包含听力训练、视频训练、全局词库、账号权限、管理员数据维护、上传校验，以及训练内容备份/恢复能力。

项目默认部署在子路径 `/listen` 下，本地开发访问地址通常是：

```bash
http://localhost:3000/listen
```

## 功能概览

### 听力训练

- 管理员上传音频和句子分段，普通用户进入训练页学习。
- 支持音频播放、当前句高亮、点击句子跳转、单句重复、播放速度控制。
- 支持全部翻译/当前句翻译切换、听写模式、专注模式。
- 支持句子级生词和笔记，训练页保存的生词会汇总到全局词库。
- 常用快捷键：
  - `Space`：播放/暂停
  - `ArrowUp / ArrowDown`：上一句/下一句
  - `R`：重复当前句
  - `T`：切换全部翻译
  - `D`：切换当前句翻译
  - 听写输入中 `Ctrl+I` 显示首字母提示，`Ctrl+L` 显示完整单词

### 视频训练

- 管理员创建视频训练条目，维护视频元数据、字幕、封面和角色信息。
- 视频文件当前通过文件名引用 `public/video` 中已有媒体文件。
- 支持字幕列表、字幕跳转、角色筛选、字幕生词本、短语笔记。
- 支持封面上传、封面位置调整、角色头像维护。
- 视频页支持 `Space` 播放/暂停，`Esc` 退出窗口全屏或关闭弹窗。

### 全局词库

- 路径：`/listen/vocabulary`
- 汇总听力句子笔记和视频字幕笔记中的结构化生词。
- 支持搜索、排序和 Myqwerty 兼容导出。
- 导出接口：`GET /listen/api/vocabulary/global/export`

### 账号与权限

- 使用 NextAuth 和本地账号系统。
- 角色：
  - `ADMIN`：上传、编辑、删除训练内容，管理用户，执行备份/恢复。
  - `USER`：学习训练内容，记录自己的笔记/生词，管理头像。
- 普通用户登录后可看到 `HELP` 引导入口；管理员和游客不显示该入口。
- 普通用户首次未读引导时显示 `NEW`，点击 `GOT IT` 后写入账号级状态。

### 上传校验

服务端会在写入文件前校验扩展名、MIME 和实际文件头，不限制文件大小。

- 头像和封面只允许图片：`jpg`、`jpeg`、`png`、`webp`、`gif`、`avif`
- 听力音频只允许音频：`mp3`、`wav`、`ogg`、`oga`、`m4a`、`webm`
- 视频训练的主媒体文件当前是管理员手动放入 `public/video` 后通过文件名引用。

### 训练内容备份与恢复

管理员首页顶部有 `BACKUP` 入口。

- 备份范围：
  - 听力训练条目、句子分段、音频文件
  - 视频训练条目、字幕、角色、视频文件、封面、角色头像
- 不备份：
  - 用户账号
  - 用户笔记和生词本
  - 学习统计
  - 字典库
  - 用户头像
- 默认备份目录：
  - 优先使用环境变量 `TRAINING_BACKUP_DIR`
  - 未配置时使用 `storage/training-backups`
- 备份机制：
  - 每个快照包含 `manifest.json`
  - 媒体文件按 sha256 内容寻址保存到 `objects/`
  - 当前数据和最新备份一致时返回 no-op，不创建新快照
- 恢复机制：
  - 先 `RESTORE PREVIEW`
  - 确认后覆盖当前听力和视频训练内容
  - 恢复前会自动创建 safety snapshot
  - 恢复前校验 manifest、对象文件存在性和 hash

如果数据库引用的媒体文件不存在，备份会拒绝创建并提示缺失文件。视频训练尤其需要确认 `public/video` 中存在对应视频文件。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- NextAuth v5
- Prisma 7
- SQLite + `better-sqlite3`
- 本地文件系统存储媒体文件

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

项目根目录需要 `.env` 或部署环境变量。不要把真实密钥提交到仓库。

```env
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="replace-with-a-long-random-secret"

ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-this-password"
ADMIN_NAME="Admin"

NEXT_PUBLIC_BASE_PATH="/listen"
TRAINING_BACKUP_DIR="E:/EnglishLearningBackups"
OPENAI_API_KEY=""
```

说明：

- `DATABASE_URL`：SQLite 数据库位置。
- `AUTH_SECRET`：NextAuth 会话密钥，生产环境必须固定且足够长。
- `ADMIN_*`：用于 `npm run seed:admin` 创建或更新管理员账号。
- `NEXT_PUBLIC_BASE_PATH`：项目默认是 `/listen`，需要和 `next.config.ts` 的 `basePath` 保持一致。
- `TRAINING_BACKUP_DIR`：训练内容备份目录，建议配置到项目目录之外，并同步到外部磁盘、NAS 或云盘。
- `OPENAI_API_KEY`：视频字幕翻译草稿等 AI 功能需要使用。

### 3. 初始化数据库

开发环境：

```bash
npx prisma migrate dev
npx prisma generate
```

生产或已有迁移环境：

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. 创建管理员账号

```bash
npm run seed:admin
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问：

```bash
http://localhost:3000/listen
```

## 常用脚本

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm start            # 启动生产服务器
npm run lint         # ESLint 检查
npm run seed:admin   # 创建或更新管理员账号
npm run sync:ecdict  # 同步 ECDICT 字典数据
```

## 数据与文件位置

```text
prisma/dev.db                  SQLite 主数据库
prisma/migrations/             Prisma 迁移
.prisma/client/default/        生成的 Prisma Client

public/audio/                  听力训练音频
public/video/                  视频训练主媒体文件
public/video-covers/           视频封面和角色头像
public/user-avatars/           用户头像

data/ecdict.sqlite             本地词典数据库
storage/training-backups/      默认训练内容备份目录
```

注意：

- `public/audio`、`public/video-covers`、`public/user-avatars` 需要写入权限。
- `public/video` 中的视频文件通常由管理员手动放入，再在视频上传页填写文件名。
- `storage/training-backups/` 已加入 `.gitignore`；如果使用 `TRAINING_BACKUP_DIR`，建议设置到项目目录之外。
- `data/ecdict.sqlite` 是字典数据，不属于训练内容备份范围。

## 主要页面

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 听力首页 | `/listen` | 听力训练列表 |
| 视频首页 | `/listen/video` | 视频训练列表 |
| 听力详情 | `/listen/training/[id]` | 听力训练页面 |
| 视频详情 | `/listen/video/[id]` | 视频训练页面 |
| 听力上传 | `/listen/upload` | 管理员上传听力训练 |
| 视频上传 | `/listen/video/upload` | 管理员创建视频训练 |
| 全局词库 | `/listen/vocabulary` | 生词汇总和导出 |
| 用户管理 | `/listen/admin/users` | 管理员管理账号 |
| 登录 | `/listen/login` | 用户登录 |

## 主要 API

| API | 权限 | 说明 |
| --- | --- | --- |
| `GET /listen/api/training-items` | 登录用户 | 获取听力训练列表 |
| `POST /listen/api/training-items` | 管理员 | 创建听力训练 |
| `GET /listen/api/training-items/[id]` | 登录用户 | 获取听力训练详情 |
| `PUT /listen/api/training-items/[id]` | 管理员 | 更新听力训练 |
| `DELETE /listen/api/training-items/[id]` | 管理员 | 删除听力训练 |
| `GET /listen/api/video-training-items` | 登录用户 | 获取视频训练列表 |
| `POST /listen/api/video-training-items` | 管理员 | 创建视频训练 |
| `GET /listen/api/video-training-items/[id]` | 登录用户 | 获取视频训练详情 |
| `PUT /listen/api/video-training-items/[id]` | 管理员 | 更新视频训练 |
| `DELETE /listen/api/video-training-items/[id]` | 管理员 | 删除视频训练 |
| `GET /listen/api/vocabulary/global` | 登录用户 | 获取全局词库 |
| `GET /listen/api/vocabulary/global/export` | 登录用户 | 导出 Myqwerty 兼容词库 |
| `GET /listen/api/account/me` | 登录用户 | 获取当前账号 |
| `PATCH /listen/api/account/me` | 登录用户 | 更新头像 |
| `GET /listen/api/account/help-guide` | 普通用户 | 获取 Help 引导状态 |
| `PATCH /listen/api/account/help-guide` | 普通用户 | 标记 Help 引导已读 |
| `GET /listen/api/admin/training-backups` | 管理员 | 获取备份状态 |
| `POST /listen/api/admin/training-backups` | 管理员 | 创建或检查备份 |
| `POST /listen/api/admin/training-backups/restore/preview` | 管理员 | 预览恢复 |
| `POST /listen/api/admin/training-backups/restore` | 管理员 | 确认恢复 |

## 部署建议

1. 在服务器上安装依赖并配置环境变量。
2. 确认 `NEXT_PUBLIC_BASE_PATH=/listen`，并在反向代理中保留 `/listen` 路径。
3. 执行数据库迁移和 Prisma Client 生成。
4. 创建管理员账号。
5. 确认以下目录有写入权限：
   - `public/audio`
   - `public/video-covers`
   - `public/user-avatars`
   - `TRAINING_BACKUP_DIR` 或 `storage/training-backups`
6. 把 `TRAINING_BACKUP_DIR` 同步到外部磁盘、NAS 或云盘，避免本机硬盘故障导致备份一并丢失。
7. 执行生产构建并启动：

```bash
npm run build
npm start
```

## 维护注意事项

- 修改 Prisma schema 后需要创建迁移并重新生成 client。
- `.prisma/client/default` 当前被项目直接引用，执行 `npx prisma generate` 后会产生代码变更。
- 训练内容备份不等于整站备份；如果要完整恢复账号、用户笔记、生词和学习记录，还需要备份 SQLite 数据库或扩展备份范围。
- 删除训练内容不会清理历史备份对象，避免误删后无法恢复。
- 如果恢复训练内容，当前听力和视频训练表会被快照内容覆盖；恢复前系统会自动创建 safety snapshot。
