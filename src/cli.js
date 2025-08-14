import { program } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { runActions } from './ssh-runner.js';
import { ACTION_TEMPLATE } from './templates/action-template.js';

// 解决ES模块中的__dirname问题
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 定义初始化命令
program
  .command('init')
  .description('初始化配置文件')
  .option('-e, --env <filename>', '自定义环境变量文件名', '.sv-ssh.env')
  .option('-a, --actions <filename>', '自定义操作流程文件名', 'sv-ssh-actions.js')
  .action(async (options) => {
    try {
      // 收集服务器配置信息
      const configAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'host',
          message: '服务器IP地址:',
          validate: (input) => {
            // 检查IP地址格式
            const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
            if (!ipRegex.test(input)) {
              return '请输入有效的IP地址';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'port',
          message: '端口号:',
          default: '22',
          validate: (input) => !isNaN(Number(input)) || '请输入有效的端口号',
        },
        {
          type: 'input',
          name: 'username',
          message: '登录账号:',
          validate: (input) => input.trim() !== '' || '账号不能为空',
        },
        { type: 'password', name: 'password', message: '登录密码:' },
        {
          type: 'input',
          name: 'privateKey',
          message: '密钥文件路径(可选,输入 N 表示不使用密钥):',
          default:
            process.platform === 'win32'
              ? path.join(process.env.USERPROFILE, '.ssh', 'id_rsa')
              : path.join(os.homedir(), '.ssh', 'id_rsa'),
          validate: (input) => {
            if (input.trim().toLowerCase() === 'n') {
              return true;
            }
            // 检查密钥文件是否存在
            if (!fs.existsSync(input)) {
              return `❌ 密钥文件不存在: ${input}`;
            }
            // 检查密钥文件权限
            const stats = fs.statSync(input);
            if ((stats.mode & 0o777) !== 0o600) {
              throw new Error(`❌ 密钥文件权限错误: ${input}`);
            }
            return true;
          },
        },
      ]);

      // 处理密钥文件路径
      if (configAnswers.privateKey.trim().toLowerCase() === 'n') {
        configAnswers.privateKey = '';
      }

      // 生成.env文件
      const envContent = `# 服务器连接配置
HOST=${configAnswers.host}
PORT=${configAnswers.port}
USERNAME=${configAnswers.username}
PASSWORD=${configAnswers.password || ''}
PRIVATE_KEY=${configAnswers.privateKey || ''}
# 自定义配置，可在自定义操作流程中使用
CUSTOM_CONFIG=custom-value
`;

      // 如果没有指定环境变量文件名，或者是默认值 .sv-ssh.env， 则默认使用 .sv-ssh.env
      if (!options.env || options.env === '.sv-ssh.env') {
        // 提示用户输入 环境变量文件名
        let { envFilename } = await inquirer.prompt([
          {
            type: 'input',
            name: 'envFilename',
            message: '请输入环境变量文件名:',
            default: '.sv-ssh.env',
          },
        ]);
        // 如果不带文件扩展名， 则添加 .env 扩展名
        if (!path.extname(envFilename)) {
          envFilename += '.env';
        }
        options.env = envFilename;
      }
      // 检查环境变量文件是否存在
      const envExists = fs.existsSync(options.env);
      if (envExists) {
        const { overwriteEnv } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwriteEnv',
            message: `${options.env}已存在，是否覆盖?`,
            default: false,
          },
        ]);
        if (!overwriteEnv) {
          console.log(`⚠️ 已跳过${options.env}文件生成`);
        } else {
          fs.writeFileSync(options.env, envContent);
          console.log(`✅ ${options.env}配置文件已更新`);
        }
      } else {
        fs.writeFileSync(options.env, envContent);
        console.log(`✅ ${options.env}配置文件已生成`);
      }

      // 生成操作流程模板文件
      const actionsContent = ACTION_TEMPLATE;
      // 如果没有指定操作流程文件名，或者是默认值 sv-ssh-actions.js， 则默认使用 sv-ssh-actions.js
      if (!options.actions || options.actions === 'sv-ssh-actions.js') {
        // 提示用户输入 操作流程文件名
        let { actionsFilename } = await inquirer.prompt([
          {
            type: 'input',
            name: 'actionsFilename',
            message: '请输入操作流程文件名:',
            default: 'sv-ssh-actions.js',
          },
        ]);
        // 如果不带文件扩展名， 则添加 .js 扩展名
        if (!path.extname(actionsFilename)) {
          actionsFilename += '.js';
        }
        options.actions = actionsFilename;
      }
      // 检查操作流程文件是否存在
      const actionsExists = fs.existsSync(options.actions);
      if (actionsExists) {
        const { overwriteActions } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwriteActions',
            message: `${options.actions}已存在，是否覆盖?`,
            default: false,
          },
        ]);
        if (!overwriteActions) {
          console.log(`⚠️ 已跳过${options.actions}文件生成`);
        } else {
          fs.writeFileSync(options.actions, actionsContent);
          console.log(`✅ 操作流程文件已更新: ${options.actions}`);
        }
      } else {
        fs.writeFileSync(options.actions, actionsContent);
        console.log(`✅ 操作流程文件已生成: ${options.actions}`);
      }

      // 生成完成，检查是否有 .gitignore 文件
      const gitignoreExists = fs.existsSync('.gitignore');
      if (gitignoreExists) {
        // 提示用户，是否将刚刚生成的两个文件 options.env、options.actions、.sv-ssh-ignore 添加到 .gitignore
        const { addToGitignore } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addToGitignore',
            message: `是否将 ${options.env}、${options.actions}添加到 .gitignore?`,
            default: true,
          },
        ]);
        if (addToGitignore) {
          // 如果.gitignore文件已存在 options.env、options.actions， 则不添加
          [options.env, options.actions].forEach((item) => {
            const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
            if (gitignoreContent.includes(item)) {
              console.log(`⚠️ ${item} 已存在于 .gitignore， 未添加`);
            } else {
              // 添加到 # sv-ssh配置文件 下面的空行
              const gitignoreLines = gitignoreContent.split('\n');
              const svSshIndex = gitignoreLines.findIndex((line) =>
                line.includes('# sv-ssh配置文件'),
              );
              if (svSshIndex !== -1) {
                gitignoreLines.splice(svSshIndex + 1, 0, item);
              } else {
                gitignoreLines.push(`\n# sv-ssh配置文件\n${item}`);
              }
              fs.writeFileSync('.gitignore', gitignoreLines.join('\n'));
              console.log(`✅ ${item} 已添加到 .gitignore`);
            }
          });
        } else {
          console.log(`✅ ${options.env}、${options.actions} 未添加到 .gitignore`);
        }
      }
    } catch (error) {
      console.error('❌ 配置过程出错:', error.message);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('执行操作流程')
  .option('-e, --env <filename>', '指定SSH环境变量文件', '.sv-ssh.env')
  .option('-a, --actions <filename>', '指定操作流程文件', 'sv-ssh-actions.js')
  .action(async (opts) => {
    try {
      let options = opts;
      // 用户可以自定义一个 .sv-ssh-ignore 文件， 里面写要排除的文件名
      const ignoreFileExists = fs.existsSync('.sv-ssh-ignore');
      let excludeFiles = [];
      if (ignoreFileExists) {
        excludeFiles = fs.readFileSync('.sv-ssh-ignore', 'utf8').split('\n');
      } else {
        excludeFiles = [
          '.env',
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
      }
      // 如果没有指定环境变量文件名，或者是默认值 .sv-ssh.env
      if (
        (!options.env || options.env === '.sv-ssh.env') &&
        !program.args.includes('.sv-ssh.env')
      ) {
        // 提示选择环境变量文件名
        const envChoices = fs
          .readdirSync('./')
          .filter((file) => file.endsWith('.env') && !excludeFiles.includes(file));
        if (envChoices.length === 0) {
          console.error(
            '❌ 错误: 没有找到环境变量文件，请先创建 .sv-ssh.env 文件 或 npx sv-ssh init 后重试',
          );
          process.exit(1);
        }
        if (envChoices.length > 1) {
          const { envFilename } = await inquirer.prompt([
            {
              type: 'list',
              name: 'envFilename',
              message: '请选择环境变量文件名:',
              choices: envChoices,
            },
          ]);
          options.env = envFilename;
        }
      }
      // 如果没有指定操作流程文件名，或者是默认值 sv-ssh-actions.js
      if (
        (!options.actions || options.actions === 'sv-ssh-actions.js') &&
        !program.args.includes('sv-ssh-actions.js')
      ) {
        // 提示选择操作流程文件名
        // 获取操作流程文件选项并检查是否为空
        const actionChoices = fs
          .readdirSync('./')
          .filter((file) => file.endsWith('.js') && !excludeFiles.includes(file));
        if (actionChoices.length === 0) {
          console.error(
            '❌ 错误: 没有找到操作流程文件，请先创建 .sv-ssh-actions.js 文件 或 npx sv-ssh init 后重试',
          );
          process.exit(1);
        }
        if (actionChoices.length > 1) {
          const { actionsFilename } = await inquirer.prompt([
            {
              type: 'list',
              name: 'actionsFilename',
              message: '请选择操作流程文件名:',
              choices: actionChoices,
            },
          ]);
          options.actions = actionsFilename;
        }
      }
      // 执行操作流程，传递配置参数
      await runActions(options);
    } catch (error) {
      console.error('❌ 执行操作失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);

// 如果没有提供命令，显示帮助信息
if (process.argv.length <= 2) {
  program.outputHelp();
}
