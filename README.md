# 英语学习训练网站

一个用于英语学习的训练网站，支持音频播放、句子高亮、点击跳转、单句重复播放等功能。

## 功能特性

- 📝 **训练条目管理**：上传音频文件和对应的英语句子分段
- 🎵 **音频播放**：支持音频播放，自动高亮当前播放的句子
- 🎯 **点击跳转**：点击句子可跳转到对应音频位置
- 🔁 **单句重复**：支持单句重复播放功能
- 🌐 **翻译显示**：每个句子支持中文翻译，可显示/隐藏
- 📚 **学习笔记**：每个句子支持添加生词和注释，数据存储在服务器端
- 💾 **数据持久化**：使用 SQLite 数据库存储训练条目和用户笔记

## 技术栈

- **框架**：Next.js 16 (App Router)
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **数据库**：SQLite + Prisma ORM
- **文件存储**：本地文件系统（public/audio 目录）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

数据库迁移已经创建，如果需要重新初始化：

```bash
npx prisma migrate dev
npx prisma generate
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000/listen](http://localhost:3000/listen) 查看应用。

项目固定部署在子路径 `/listen` 下，`basePath` 会在构建时写入产物，因此部署前必须先确定该路径。

## 项目结构

```
├── app/
│   ├── api/                    # API 路由
│   │   ├── training-items/    # 训练条目 API
│   │   └── user-notes/        # 用户笔记 API
│   ├── training/[id]/         # 训练条目详情页
│   ├── upload/                # 上传页面
│   └── page.tsx               # 首页（列表页）
├── lib/
│   └── prisma.ts              # Prisma 客户端
├── prisma/
│   ├── schema.prisma          # 数据库模型
│   └── migrations/            # 数据库迁移
└── public/
    └── audio/                 # 音频文件存储目录
```

## 使用说明

### 上传训练条目

1. 点击首页的"上传新训练条目"按钮
2. 填写标题
3. 选择音频文件
4. 添加句子分段：
   - 输入英语句子
   - 输入中文翻译（可选）
   - 设置开始时间和结束时间（秒）
   - 点击"添加句子"按钮
5. 重复步骤 4 添加所有句子
6. 点击"提交"完成上传

### 学习训练

1. 在首页点击训练条目进入详情页
2. 播放音频，当前句子会自动高亮显示（蓝色背景）
3. 点击任意句子可跳转到对应音频位置
4. 点击句子右侧的 🔁 按钮可开启单句重复播放
5. 使用"显示翻译"复选框控制翻译显示/隐藏
6. 点击"📝 生词和注释"展开笔记区域，添加学习笔记

## 部署到云服务器

### 1. 构建项目

```bash
npm run build
```

### 2. 启动生产服务器

```bash
npm start
```

### 3. 环境变量

确保环境变量配置正确。生产环境需要在构建前提供子路径前缀：

```
DATABASE_URL="file:./prisma/dev.db"
NEXT_PUBLIC_BASE_PATH=/listen
```

生产访问路径为 `https://enlearningforreveone.site/listen`。

### 4. 文件权限

确保 `public/audio` 目录有写入权限，用于存储上传的音频文件。

## Global Vocabulary Library

- Homepage now includes a `GLOBAL VOCAB` entry button above the training card grid.
- Global vocabulary page path: `http://localhost:3000/listen/vocabulary`
- Production path: `https://enlearningforreveone.site/listen/vocabulary`

### New APIs

- `GET /listen/api/vocabulary/global`
  - Returns aggregated structured vocabulary across all trainings.
  - Query params: `userId` (default `default`), `q`, `sort` (`frequency | alphabet | recent`).
- `GET /listen/api/vocabulary/global/export`
  - Returns Myqwerty-compatible export payload:
  - `version`, `generatedAt`, `totalWords`, `words[]`

### Myqwerty Sync Notes

- Myqwerty pull source defaults to `/listen/api/vocabulary/global/export`.
- For local cross-port testing, set `VITE_ENGLISH_LEARNING_EXPORT_URL`, e.g.:
  - `http://localhost:3000/listen/api/vocabulary/global/export`
  - `http://localhost:4000/listen/api/vocabulary/global/export`

## 数据库模型

- **TrainingItem**：训练条目（标题、音频路径等）
- **Sentence**：句子分段（文本、翻译、时间范围等）
- **UserNote**：用户笔记（生词、注释等）

## 注意事项

- 音频文件存储在 `public/audio` 目录中
- 数据库文件为 `prisma/dev.db`（SQLite）
- 用户笔记默认用户ID为 "default"，可以后续扩展为多用户系统
- 建议定期备份数据库和音频文件

## 开发计划

- [ ] 支持多用户系统
- [ ] 添加音频波形可视化
- [ ] 支持视频文件
- [ ] 添加学习进度统计
- [ ] 支持导出学习笔记
