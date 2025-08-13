# PromptHelper - 通用 AI 助手油猴脚本

![版本](https://img.shields.io/badge/版本-1.7.0-blue)
![许可证](https://img.shields.io/badge/许可证-MIT-green)
![Tampermonkey](https://img.shields.io/badge/油猴脚本-支持-orange)

**语言版本**: [English](https://github.com/dongshuyan/PromptHelper) | [中文](https://github.com/dongshuyan/PromptHelper/blob/master/README-zh.md)

一个强大的通用型油猴脚本，为 10 大主流 AI 平台提供智能化 Prompt 模板管理功能。支持一键模板应用、智能读取聊天输入内容，以及高级模板管理和站点专属默认设置。

## ✨ 主要特性

### 🌐 全平台支持
- **ChatGPT** (chat.openai.com / chatgpt.com)
- **Google Gemini** (gemini.google.com) 
- **Claude** (claude.ai)
- **Kimi** (kimi.com / kimi.moonshot.cn)
- **DeepSeek** (chat.deepseek.com)
- **通义千问** (tongyi.com)
- **腾讯元宝** (yuanbao.tencent.com)
- **Google AI Studio** (aistudio.google.com)
- **Grok** (grok.com)
- **豆包** (doubao.com)

### 🎛️ 核心功能
- **智能内容读取**：自动从聊天输入框读取问题内容
- **内置高级模板**：提供专业的交互式提问模板，让 AI 回答更准确具体
- **一键应用模板**："应用默认模板"按钮实现瞬间套用模板
- **多模板管理**：创建、编辑和组织无限数量的自定义模板
- **站点专属默认**：为不同 AI 平台设置不同的默认模板
- **智能模板规则**：支持通配符和基于优先级的模板选择
- **导入导出**：备份和分享您的模板集合
- **双语界面**：无缝中英文语言切换
- **可定制界面**：可调节按钮位置、大小和外观

### 🔧 技术亮点
- **智能输入识别**：跨平台高级输入元素识别技术
- **Claude 换行保真**：完美保持 Claude ProseMirror 编辑器的格式
- **Kimi 专项优化**：针对 Kimi 的 Lexical 编辑器特殊处理
- **Shadow DOM 兼容**：与现代 Web 架构无缝集成
- **模板变量系统**：动态 `{User Question}` 占位符替换
- **并发操作安全**：防止同时操作时的数据冲突

## 🚀 安装方法

### 前置要求
确保您的浏览器已安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展。

### 安装步骤
1. 访问脚本页面：https://greasyfork.org/zh-CN/scripts/545456-prompthelper
2. 点击"安装此脚本"
3. 访问任意支持的 AI 平台即可开始使用

## 📖 使用指南

### 界面概览

安装后，您会在支持的 AI 平台上看到蓝色的"Helper"按钮：

![默认侧边栏按钮](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P1.png)

### 一键模板应用

最简单的使用方式 - 在聊天输入框中输入问题，然后点击"应用默认模板"：

![一键模板应用](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P2.png)

### 主界面

点击"Helper"按钮访问完整的控制面板和模板管理功能：

![Helper 主界面](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P3.png)

### 多模板选择

从多个模板中选择或创建您自己的自定义模板：

![多模板选择](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P4.png)

### 高级设置

访问全面的设置界面进行个性化定制和模板管理：

![设置界面](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P5.png)

设置功能包括：
- 为特定网站设置默认模板
- 自定义 Helper 按钮位置和大小
- 导入/导出模板集合
- 配置模板规则和优先级

### 模板规则管理

创建支持通配符的复杂模板规则：

![模板规则管理](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P6.png)

### 规则创建教程

创建自定义模板规则的分步指导：

![规则创建教程](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P7.png)

## 📋 内置高级模板

**通用交互式提问模板**：结合系统性思维与网络检索能力的专业模板。具备审计级研究方法论、多角度分析和引用支撑的推理链。非常适合需要深度调研和循证回答的复杂问题，让 AI 回答更准确具体。

## 🎯 使用流程

### 基础使用
1. **在 AI 平台的聊天输入框中输入问题**
2. **点击"应用默认模板"**实现瞬间模板套用
3. **发送增强后的提示**获得更优质的 AI 回答

### 高级使用
1. **在设置中为不同 AI 平台设置专属默认模板**
2. **创建自定义模板**应对专业使用场景
3. **使用模板规则**通过通配符实现自动模板选择
4. **导入/导出模板**与团队成员分享

## 🔍 模板变量

在模板内容中使用 `{User Question}` 作为占位符，将自动替换为聊天输入框中的内容。

**示例模板：**
```
请对以下问题进行全面分析，并提供基于证据的推理：

问题：{User Question}

请按以下结构组织回答：
1. 核心洞察
2. 支撑证据  
3. 实际意义
```

## 🎨 界面设计

- **简约侧边栏**：干净的蓝色按钮，不干扰原网站使用
- **智能定位**：可自定义按钮位置和大小
- **响应式设计**：适应不同屏幕尺寸和布局
- **主题兼容**：与浅色和深色主题完美配合
- **样式隔离**：完全隔离的 CSS 防止冲突

## 🛠️ 开发信息

### 技术栈
- **纯 JavaScript ES6+**：无外部依赖
- **Tampermonkey API**：本地存储和样式注入
- **高级 DOM 操作**：跨平台输入检测
- **现代事件处理**：针对不同框架优化

### 核心技术特性
1. **跨平台兼容性**：通用输入元素检测
2. **框架支持**：React、Angular、Vue 和原生 JS 兼容
3. **智能内容处理**：智能文本提取和注入
4. **并发操作安全**：线程安全的模板操作

## 📝 更新日志

### v1.7.0 (当前版本)
**🎯 重大架构升级**
- **一键模板应用**：新增"应用默认模板"按钮实现瞬间使用
- **智能内容读取**：自动从聊天输入读取而非独立文本框
- **站点专属默认**：为不同 AI 平台设置不同默认模板
- **模板规则系统**：高级通配符支持和基于优先级的选择
- **界面全面升级**：重新设计的界面提升易用性
- **导入导出功能**：完整的模板备份和分享功能
- **Claude 专项优化**：完美的换行格式保持
- **平台支持扩展**：新增 Grok 和豆包兼容性

## 🛡️ 隐私与安全

- **仅本地存储**：所有数据仅保存在浏览器本地，绝不上传
- **开源透明**：GitHub 仓库完全透明
- **最小权限**：仅使用必要的 Tampermonkey 权限
- **无外部依赖**：自包含脚本，无第三方调用

## 🐛 问题反馈

如需支持或报告问题，请提供：
- **浏览器类型和版本**
- **Tampermonkey 版本**
- **AI 平台和 URL**
- **详细错误描述**
- **控制台错误信息**（F12 → Console）

## 📄 许可证

本项目采用 [MIT 许可证](https://opensource.org/licenses/MIT) 开源。

## 🤝 贡献指南

欢迎贡献！您可以：
- 报告错误或建议功能
- 提交代码改进
- 改善文档
- 分享使用示例和最佳实践

## 📞 联系方式

- **作者**：Sauterne
- **项目地址**：https://github.com/dongshuyan/PromptHelper
- **脚本地址**：https://greasyfork.org/zh-CN/scripts/545456-prompthelper
- **许可证**：MIT
- **最新版本**：v1.7.0

---

> **💡 提示**：PromptHelper 让 AI 交互更高效更有效果。试试一键模板应用功能，立即提升您的 AI 对话质量！