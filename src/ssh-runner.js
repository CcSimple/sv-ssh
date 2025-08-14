import dotenv from 'dotenv';
import { NodeSSH } from 'node-ssh';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 解决ES模块中的__dirname问题
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 执行 actions.js 中定义的服务器操作流程
 * @param {Object} options - 执行选项
 * @param {string} options.env - 环境变量文件路径
 * @param {string} options.actions - 操作流程文件路径
 */
async function runActions(options) {
  // 使用从CLI传递的配置参数
  const envFile = options.env || '.sv-ssh.env';
  const actionsFile = options.actions || 'sv-ssh-actions.js';

  // 加载指定的环境变量文件
  dotenv.config({ path: envFile });

  // 检查必要的环境变量
  const requiredEnvVars = ['HOST', 'PORT', 'USERNAME'];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('❌ 缺少必要的环境变量:', missingVars.join(', '));
    console.error('请先运行 `npx sv-ssh init` 配置服务器信息');
    process.exit(1);
  }

  // 配置
  const config = process.env;
  // 导入操作流程
  let actionsConfig;
  let actionsPath;
  try {
    // 动态导入指定的操作流程文件
    actionsPath = path.resolve(process.cwd(), actionsFile);
    console.log(`🔍 正在加载操作流程文件: ${actionsPath}`);
    // 读取文件内容并转换ES模块语法为CommonJS
    const fileContent = fs
      .readFileSync(actionsPath, 'utf8')
      .replace(/export\s+default\s*/g, 'module.exports = ');
    // 使用IIFE包装执行环境，避免污染全局作用域
    const actionsModule = eval(
      `(function(exports, module) { ${fileContent}; return module.exports || exports; })({}, {})`,
    );
    actionsConfig = actionsModule.default || actionsModule;
    if (!Array.isArray(actionsConfig)) {
      throw new Error('操作流程文件必须导出一个数组');
    }
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error(`❌ 错误: 无法加载操作流程文件 - ${actionsPath}`);
      console.error('   可能原因: 文件路径错误或文件内容格式不正确');
      console.error('👉 请检查文件是否存在或重新生成:');
      console.error('   npx sv-ssh init');
    } else {
      console.error(`❌ 加载操作流程文件失败: ${error.message}`);
    }
    process.exit(1);
  }
  // 创建SSH客户端
  const ssh = new NodeSSH();
  try {
    console.log('🔄 正在连接服务器...');
    await ssh.connect({
      host: process.env.HOST,
      port: parseInt(process.env.PORT, 10),
      username: process.env.USERNAME,
      password: process.env.PASSWORD || undefined,
      privateKeyPath: process.env.PRIVATE_KEY || undefined,
    });
    console.log('✅ 服务器连接成功');

    // 存储上一步操作的输出，用于后续操作引用
    let previousOutput = null;

    // 执行每个操作
    for (const [index, action] of actionsConfig.entries()) {
      const stepNumber = index + 1;
      console.log(`\n===== 步骤 ${stepNumber}: ${action.name} =====`);
      try {
        switch (action.type) {
          case 'compress':
            // 处理压缩操作
            const output = fs.createWriteStream(action.outputPath);
            const archive = archiver('zip', action.options || { zlib: { level: 9 } });

            output.on('close', () => {
              console.log(`压缩完成: ${archive.pointer()} 字节`);
            });

            archive.on('error', (err) => {
              throw err;
            });

            archive.pipe(output);
            archive.directory(action.localDir, false);
            await archive.finalize();

            previousOutput = action.outputPath;
            console.log(`✅ 压缩成功: ${action.outputPath}`);
            break;

          case 'upload':
            // 处理上传操作
            const localPath = action.localPath === 'previous' ? previousOutput : action.localPath;
            if (!fs.existsSync(localPath)) {
              throw new Error(`本地文件不存在: ${localPath}`);
            }

            // 检查远程目录是否存在，不存在则创建
            if (action.options?.createDir) {
              const remoteDir = path.dirname(action.remotePath);
              await ssh.execCommand(`mkdir -p ${remoteDir}`);
            }

            await ssh.putFile(localPath, action.remotePath);
            previousOutput = action.remotePath;
            console.log(`✅ 文件上传成功: ${localPath} -> ${action.remotePath}`);
            break;

          case 'move':
            // 处理移动操作
            // 是否覆盖
            await ssh.execCommand(
              `mv ${action.options?.overwrite || false ? '-f' : ''} ${action.remoteSource} ${action.remoteDestination}`,
            );
            // 移动操作完成后，更新 previousOutput 为目标路径
            previousOutput = action.remoteDestination;
            console.log(`✅ 文件移动成功: ${action.remoteSource} -> ${action.remoteDestination}`);
            break;

          case 'copy':
            // 处理复制操作 - 先创建目标目录并检查错误
            if (action.options?.createDir) {
              const destDir = path.dirname(action.remoteDestination);
              const mkdirResult = await ssh.execCommand(`mkdir -p ${destDir}`);
              if (mkdirResult.stderr) throw new Error(`创建目标目录失败: ${mkdirResult.stderr}`);
            }

            // 执行复制操作，添加覆盖选项并检查错误
            const cpResult = await ssh.execCommand(
              `cp ${action.options?.overwrite || false ? '-f' : ''} ${action.remoteSource} ${action.remoteDestination}`,
            );
            if (cpResult.stderr) throw new Error(`文件复制失败: ${cpResult.stderr}`);
            previousOutput = action.remoteDestination;
            console.log(`✅ 文件复制成功: ${action.remoteSource} -> ${action.remoteDestination}`);
            break;

          case 'rename':
            // 处理重命名操作
            // 是否覆盖
            await ssh.execCommand(
              `mv ${action.options?.overwrite || false ? '-f' : ''} ${action.remoteSource} ${action.remoteDestination}`,
            );
            previousOutput = action.remoteDestination;
            console.log(`✅ 文件重命名成功: ${action.remoteSource} -> ${action.remoteDestination}`);
            break;

          case 'unzip':
            // 处理解压操作
            const unzipCommand = `unzip ${action.options?.overwrite || false ? '-o' : ''} ${action.remoteSource} -d ${action.remoteDestination}`;
            await ssh.execCommand(unzipCommand);
            previousOutput = action.remoteDestination;
            console.log(`✅ 文件解压成功: ${action.remoteSource} -> ${action.remoteDestination}`);
            break;

          case 'delete':
            // 处理删除操作
            // 删除本地文件/目录
            if (action.localDir) {
              // 判断是否是文件
              if (fs.statSync(action.localDir).isFile()) {
                // 删除文件
                fs.unlinkSync(action.localDir);
              } else {
                // 删除目录
                fs.rmSync(action.localDir, {
                  recursive: action.options?.recursive || false,
                  force: action.options?.force || false,
                });
              }
            }
            // 通过参数判断是否递归删除
            // 通过参数是否强制删除
            await ssh.execCommand(
              `rm ${action.options?.recursive || false ? '-r' : ''} ${action.options?.force || false ? '-f' : ''} ${action.remotePath}`,
            );
            previousOutput = null;
            console.log(`✅ 文件删除成功: ${action.remotePath}`);
            break;

          case 'command':
            // 处理命令执行操作
            const { command } = action;
            if (!command) {
              throw new Error('命令不能为空');
            }
            console.log(`执行命令: ${command}`);
            const { stdout, stderr } = await ssh.execCommand(command);
            // 输出命令执行日志
            if (stdout) console.log(`命令输出:\n${stdout}`);
            if (stderr) console.error(`命令错误:\n${stderr}`);
            previousOutput = stdout;
            console.log(`✅ 命令执行成功`);
            break;

          case 'custom':
            // 处理自定义操作
            if (typeof action.function !== 'function') {
              throw new Error('自定义操作必须提供function属性');
            }
            console.log(`执行自定义操作: ${action.name}`);
            const customResult = await action.function(
              ssh,
              previousOutput,
              config,
              action,
              actionsConfig,
            );
            previousOutput = customResult;
            console.log(`✅ 自定义操作执行成功`);
            break;

          default:
            throw new Error(`不支持的操作类型: ${action.type}`);
        }
      } catch (error) {
        console.error(`❌ 操作失败: ${error.message}`);
        // 断开SSH连接并退出
        await ssh.dispose();
        process.exit(1);
      }
    }

    // 所有操作完成，断开连接
    await ssh.dispose();
    console.log('\n🎉 所有操作已成功执行');
    process.exit(0);
  } catch (error) {
    console.error('❌ SSH操作失败:', error.message);
    process.exit(1);
  }
}

export { runActions };
