# SV-SSH: 服务器操作自动化工具

一个基于Node.js的命令行工具，帮助开发者通过SSH自动化服务器操作流程，支持自定义配置和操作流程定义。

## ✨ 特性

- 交互式配置服务器连接信息
- 支持自定义环境变量文件和操作流程文件
- 内置文件压缩、上传、移动、复制、重命名、解压、命令行、删除等操作
- 支持自定义操作函数，扩展功能
- 代码风格统一（ESLint + Prettier）
- 支持多个配置文件，每个文件对应不同的服务器环境或操作流程

## 🚀 快速开始

### 通过npx使用

```bash
npx sv-ssh init
npx sv-ssh run
```

### 全局安装

```bash
npm install -g sv-ssh
# 初始化配置
sv-ssh init
# 运行操作流程
sv-ssh run
```

### 项目内安装

```bash
npm install sv-ssh --save-dev
# 添加到package.json脚本
# "scripts": {
#   "init": "sv-ssh init",
#   "run": "sv-ssh run"
# }
```

## ⚙️ 命令说明

### 1. 初始化配置文件

使用`init`命令创建配置文件和操作流程模板：

```bash
# 默认初始化（生成.sv-ssh.env和sv-ssh-actions.js）
sv-ssh init

# 自定义环境变量文件名和操作流程文件名
sv-ssh init -e my-env.env -a my-actions.js
```

`init`命令选项：

- `-e, --env <filename>`: 自定义环境变量文件名（默认：.sv-ssh.env）
- `-a, --actions <filename>`: 自定义操作流程文件名（默认：sv-ssh-actions.js）

执行后将引导您输入服务器IP、端口、用户名、密码和密钥文件路径等配置信息。密钥文件默认路径：

- macOS/Linux: ~/.ssh/id_rsa
- Windows: C:\Users\用户名\.ssh\id_rsa

### 2. 执行操作流程

执行时将读取环境变量文件中的服务器配置，并按照操作流程文件中的定义执行一系列SSH操作。

使用`run`命令执行定义的操作流程：

```bash
# 使用默认配置文件执行
sv-ssh run

# 指定自定义配置文件
sv-ssh run -e my-env.env -o my-actions.js
```

`run`命令选项：

- `-e, --env <filename>`: 指定环境变量文件（默认：.sv-ssh.env）
- `-a, --actions <filename>`: 指定操作流程文件（默认：sv-ssh-actions.js）

> 多个配置文件支持！ run 不指定配置文件时，提供选择列表，默认使用 .sv-ssh.env 和 sv-ssh-actions.js。

> 您可以新增 .sv-ssh-ignore 文件，支持选择列表过滤的文件。

```
# .sv-ssh-ignore
.pro.env
.test.env
.eslintrc.js
.prettierrc.js
```

默认排除以下文件

```js
[
  '.eslintrc.js',
  'rollup.config.js',
  '.prettierrc.js',
  'webpack.config.js',
  'vite.config.js',
  'gulpfile.js',
  'jest.config.js',
  'mocha.config.js',
  'vue.config.js',
  'next.config.js',
  'nuxt.config.js',
  'husky.config.js',
  'lint-staged.config.js',
  'deploy.js',
  'setup.js',
  'server.js',
  'babel.config.js',
  'commitlint.config.js',
];
```

## 📝 配置文件说明

### 环境变量文件 (.sv-ssh.env)

```ini
# 服务器连接配置
HOST=your.server.ip
PORT=22
USERNAME=your-username
PASSWORD=your-password
PRIVATE_KEY=/path/to/private/key
```

### 操作流程文件 (sv-ssh-actions.js)

```javascript
/**
 * 操作流程配置文件
 * 支持的操作类型:
 * - compress: 本地文件压缩
 * - upload: 文件上传到服务器
 * - move: 服务器文件移动
 * - copy: 服务器文件复制
 * - rename: 服务器文件重命名
 * - unzip: 服务器文件解压
 * - delete: 服务器文件删除
 * - command: 执行服务器命令
 * - custom: 自定义操作函数
 */
export default [
  {
    name: '压缩本地文件',
    type: 'compress',
    localDir: './dist',
    outputPath: './dist.zip',
    options: { zlib: { level: 9 } },
  },
  {
    name: '上传到服务器',
    type: 'upload',
    localPath: './dist.zip',
    remotePath: '/tmp/dist.zip',
    options: { createDir: true },
  },
  // 更多操作...
];
```

## 操作类型说明

sv-ssh支持以下操作类型，可在sv-ssh-actions.js配置文件中定义：

### 1. 压缩操作 (compress)

- **描述**: 压缩本地文件或目录
- **参数**:
  - `localDir`: 本地待压缩目录路径
  - `outputPath`: 压缩文件输出路径
  - `options`: 压缩配置选项(可选)，如 `{ zlib: { level: 9 } }`
- **示例**:

```javascript
{
  name: '压缩源码',
  type: 'compress',
  localDir: './src',
  outputPath: './dist/source.zip',
  options: { zlib: { level: 9 } }
}
```

### 2. 文件上传 (upload)

- **描述**: 上传本地文件到远程服务器
- **参数**:
  - `localPath`: 本地文件路径，或使用 'previous' 引用前一步操作输出
  - `remotePath`: 远程服务器目标路径
  - `options`: 上传选项(可选)，如 `{ createDir: true }`
- **示例**:

```javascript
{
  name: '上传压缩包',
  type: 'upload',
  localPath: './dist/source.zip',
  remotePath: '/var/www/app/source.zip',
  options: { createDir: true },
}
```

### 3. 文件重命名 (rename)

- **描述**: 重命名远程服务器文件
- **参数**:
  - `remoteSource`: 远程源文件路径
  - `remoteDestination`: 远程目标文件路径
- **示例**:

```javascript
{
  name: '重命名文件',
  type: 'rename',
  remoteSource: '/var/www/app/source.zip',
  remoteDestination: '/var/www/app/source-v1.0.zip'
  options: { overwrite: true }, // 是否覆盖已存在文件，可选
}
```

### 4. 文件解压 (unzip)

- **描述**: 在远程服务器解压文件
- **参数**:
  - `remoteSource`: 远程待解压文件路径
  - `remoteDestination`: 远程解压目标目录
  - `options`: 解压选项(可选)，如 `{ overwrite: true }`
- **示例**:

```javascript
{
  name: '解压文件',
  type: 'unzip',
  remoteSource: '/var/www/app/source-v1.0.zip',
  remoteDestination: '/var/www/app/unzipped',
  options: { overwrite: true }
}
```

### 5. 文件移动 (move)

- **描述**: 在远程服务器移动文件或目录
- **参数**:
  - `remoteSource`: 远程源路径
  - `remoteDestination`: 远程目标路径
- **示例**:

```javascript
{
  name: '移动到生产目录',
  type: 'move',
  remoteSource: '/var/www/app/unzipped',
  remoteDestination: '/var/www/production',
  options: { overwrite: true }, // 是否覆盖已存在文件，可选
}
```

### 6. 文件复制 (copy)

- **描述**: 在远程服务器复制文件
- **参数**:
  - `remoteSource`: 远程源文件路径
  - `remoteDestination`: 远程目标文件路径
- **示例**:

```javascript
{
  name: '备份配置文件',
  type: 'copy',
  remoteSource: '/var/www/production/config.json',
  remoteDestination: '/var/www/backup/config.json',
  options: { createDir: true, overwrite: true }, // 是否覆盖已存在文件，可选
}
```

### 7. 命令执行 (command)

- **描述**: 在远程服务器执行Shell命令
- **参数**:
  - `command`: 要执行的Shell命令字符串
- **示例**:

```javascript
{
  name: '重启服务',
  type: 'command',
  command: 'pm2 restart app'
}
```

### 8. 文件删除 (delete)

- **描述**: 删除远程服务器文件
- **参数**:
  - `remotePath`: 远程文件路径
- **示例**:

```javascript
{
  name: '清理临时文件',
  type: 'delete',
  remotePath: '/var/www/app/source-v1.0.zip',
  options: { recursive: true, force: true }, // 是否递归删除，是否强制删除
  // 递归删除目录时，是否强制删除，默认false
}
```

### 9. 自定义操作 (custom)

- **描述**: 执行自定义JavaScript函数
- **参数**:
  - `function`: 自定义异步函数，接收参数 (ssh, config, action, actionsConfig, previousOutput)
    - `ssh`: SSH2连接实例
    - `config`: 配置对象，包含连接信息
    - `action`: 当前操作配置对象
    - `actionsConfig`: 所有操作配置数组
    - `previousOutput`: 前一步操作的输出结果
- **示例**:

```javascript
{
  name: '自定义部署检查',
  type: 'custom',
  function: async (ssh, config, action, actionsConfig, previousOutput) => {
    console.log('执行自定义健康检查...');
    const { stdout } = await ssh.execCommand('curl -s http://localhost/health');
    if (!stdout.includes('OK')) {
      throw new Error('服务健康检查失败');
    }
  }
}
```

## 🔧 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/CcSimple/sv-ssh.git
cd sv-ssh

# 安装依赖
npm install

# 测试 init
npm run test:init

# 测试 run
npm run test:run
```

## 📄 许可证

MIT
