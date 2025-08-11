# 通用 AI Prompt 助手 (双语版)

![版本](https://img.shields.io/badge/版本-5.6-blue)
![许可证](https://img.shields.io/badge/许可证-MIT-green)
![Tampermonkey](https://img.shields.io/badge/油猴脚本-支持-orange)

一个强大的通用型油猴脚本，为多个主流 AI 平台提供统一的 Prompt 模板管理功能。支持可收缩的侧边栏界面，让您能够高效地管理、复制和提交 Prompt 模板。

## ✨ 主要特性

### 🌐 多平台支持
- **ChatGPT** (chat.openai.com / chatgpt.com)
- **Gemini** (gemini.google.com) 
- **Claude** (claude.ai / demo.fuclaude.com)
- **Kimi** (kimi.moonshot.cn)
- **DeepSeek** (chat.deepseek.com)
- **通义千问** (tongyi.com)
- **腾讯元宝** (yuanbao.tencent.com)
- **Google AI Studio** (aistudio.google.com)

### 🎛️ 核心功能
- **模板管理**：创建、编辑、删除和保存 Prompt 模板
- **双语界面**：支持中英文切换，满足不同用户需求
- **一键操作**：支持复制到剪贴板和直接填入平台输入框
- **变量替换**：使用 `{User Question}` 占位符实现动态内容替换
- **持久化存储**：自动保存模板到本地，下次访问时恢复

### 🔧 技术特色
- **Shadow DOM 兼容**：自动处理封闭的 Shadow DOM，确保在现代 Web 应用中正常工作
- **智能输入框识别**：针对不同平台的输入框特性进行了专门适配
- **响应式设计**：优雅的可收缩侧边栏，不影响原网站使用体验

## 🚀 安装方法

### 前置要求
确保您的浏览器已安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展。

### 安装步骤
1. 复制 `AIHelper.js` 文件内容
2. 打开 Tampermonkey 管理面板
3. 点击"创建新脚本"
4. 粘贴脚本内容并保存
5. 访问任意支持的 AI 平台即可使用

## 📖 使用指南

### 基本操作
1. **打开助手**：访问支持的AI平台后，点击页面右侧的"助手"按钮
2. **选择模板**：从下拉菜单中选择预设或自定义的模板
3. **输入问题**：在"您的问题"区域填入具体问题
4. **使用模板**：
   - 点击"复制到剪贴板"：将最终的 Prompt 复制到系统剪贴板
   - 点击"填入提问栏"：直接将 Prompt 填入平台的输入框

### 模板管理
- **新建模板**：点击"新建"按钮创建空白模板
- **编辑模板**：选择现有模板后修改名称和内容
- **保存模板**：点击"保存"按钮保存更改
- **删除模板**：选择模板后点击"删除"按钮（需确认）

### 变量使用
在模板内容中使用 `{User Question}` 作为占位符，运行时会被替换为您在问题区域输入的具体内容。

**示例：**
```
请基于以下问题，提供一个清晰、结构化且全面的回答。

用户问题：
{User Question}
```

## 📋 预设模板

脚本内置了3个实用的模板：

1. **通用回答模板**：适用于一般性问题咨询
2. **代码评审模板**：专为代码审查和优化建议设计
3. **英文润色模板**：用于英文文本的语法和表达优化

## 🔧 配置说明

### 网站配置
脚本为每个支持的平台配置了专门的输入框选择器：

```javascript
const siteConfigs = {
    'openai.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea' },
    'gemini.google.com': {
        name: 'Gemini',
        shadowRootSelector: 'chat-app',
        inputSelector: 'div.initial-input-area textarea, rich-textarea .ql-editor, [contenteditable="true"][role="textbox"]'
    },
    // ... 其他平台配置
};
```

### 数据存储
- 模板数据：存储键名 `universal_prompt_helper_prompts`
- 语言设置：存储键名 `universal_prompt_helper_lang`

## 🎨 界面特性

- **固定位置侧边栏**：不影响原网站布局
- **优雅的动画效果**：平滑的展开/收起动画
- **响应式按钮组**：自适应布局的操作按钮
- **深色模式友好**：适配各种主题风格

## 🛠️ 开发信息

### 技术栈
- 纯 JavaScript ES6+
- Tampermonkey API
- CSS3 动画和 Flexbox 布局

### 关键技术点
1. **Shadow DOM 修复**：重写 `Element.prototype.attachShadow` 方法
2. **跨域兼容**：使用 `@grant` 权限访问存储 API
3. **事件处理**：使用现代事件监听器和委托模式
4. **DOM 操作**：高效的元素创建和样式注入

### 权限说明
- `GM_setValue` / `GM_getValue`：用于数据持久化存储
- `GM_addStyle`：注入自定义样式
- `@run-at document-start`：确保在页面加载前运行关键修复代码

## 🐛 问题反馈

如果您在使用过程中遇到问题，请提供以下信息：
- 浏览器类型和版本
- Tampermonkey 版本
- 具体的 AI 平台
- 错误描述和复现步骤

## 📝 更新日志

### v1.0 (当前版本)
- 支持多个主流 AI 平台
- 完善的 Shadow DOM 兼容性
- 双语界面支持
- 优化用户体验

## 📄 许可证

本项目采用 [MIT 许可证](https://opensource.org/licenses/MIT)。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

**作者**: Sauterne
**版本**: 1.0
**更新时间**: 2025年
