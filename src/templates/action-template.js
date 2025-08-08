/**
 * 操作流程配置模板
 * 支持的操作类型及参数说明:
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
export const ACTION_TEMPLATE = `/**
 * 操作流程配置文件
 * 支持的操作类型及参数说明:
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
    name: '示例压缩操作',
    type: 'compress',
    localDir: './dist', // 本地待压缩目录
    outputPath: './dist/dist.zip', // 压缩输出路径
    options: { zlib: { level: 9 } } // 压缩配置，可选
  },
  {
    name: '示例上传操作',
    type: 'upload',
    localPath: './dist/dist.zip', // 本地文件路径，或使用 'previous' 引用前一步输出
    remotePath: '/var/www/app/dist.zip', // 服务器目标路径
    options: { createDir: true }, // 若服务器目录不存在则创建，可选
  },
  {
    name: '示例重命名操作',
    type: 'rename',
    remoteSource: '/var/www/app/dist.zip', // 服务器源文件路径
    remoteDestination: '/var/www/app/dist-v1.0.zip', // 服务器目标路径
    options: { overwrite: true }, // 是否覆盖已存在文件，可选
  },
  {
    name: '示例解压操作',
    type: 'unzip',
    remoteSource: '/var/www/app/dist-v1.0.zip', // 服务器待解压文件
    remoteDestination: '/var/www/app/unzipped', // 服务器解压目标目录
    options: { overwrite: true } // 是否覆盖已存在文件，可选
  },
  {
    name: '示例移动操作',
    type: 'move',
    remoteSource: '/var/www/app/unzipped', // 服务器源路径
    remoteDestination: '/var/www/production', // 服务器目标路径
    options: { overwrite: true }, // 是否覆盖已存在文件，可选
  },
  {
    name: '示例复制操作',
    type: 'copy',
    remoteSource: '/var/www/production/index.html', // 服务器源文件
    remoteDestination: '/var/www/backup/index.html', // 服务器目标文件
    options: { createDir: true, overwrite: true }, // 是否覆盖已存在文件，可选
  },
  {
    name: '示例命令执行',
    type: 'command',
    command: 'ls -la /var/www/production' // 要执行的服务器命令
  },
  {
    name: '示例删除操作',
    type: 'delete',
    remotePath: '/var/www/app/dist-v1.0.zip', // 服务器文件路径
    options: { recursive: true, force: true }, // 是否递归删除，是否强制删除
  },
  {
    name: '示例自定义操作',
    type: 'custom',
    // 自定义操作函数，参数包括: ssh连接实例、前一步输出、配置、当前操作、所有操作配置
    function: async (ssh, previousOutput, config, action, actionsConfig) => {
      console.log('执行自定义操作...');
      // 示例: 执行命令并返回结果
      const { stdout } = await ssh.execCommand('echo "自定义操作执行成功"');
      return stdout; // 可将结果传递给后续操作
    }
  }
];
`;
