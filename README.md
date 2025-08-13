# PromptHelper - Universal AI Assistant Userscript

![Version](https://img.shields.io/badge/Version-1.7.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-orange)

**Language**: [English](https://github.com/dongshuyan/PromptHelper) | [中文](https://github.com/dongshuyan/PromptHelper/blob/master/README-zh.md)

A powerful universal userscript that provides intelligent Prompt template management across 10 mainstream AI platforms. Features one-click template application, smart content reading from chat input, and advanced template management with site-specific defaults.

## ✨ Key Features

### 🌐 Universal Platform Support
- **ChatGPT** (chat.openai.com / chatgpt.com)
- **Google Gemini** (gemini.google.com) 
- **Claude** (claude.ai)
- **Kimi** (kimi.com / kimi.moonshot.cn)
- **DeepSeek** (chat.deepseek.com)
- **Tongyi Qianwen** (tongyi.com)
- **Tencent Yuanbao** (yuanbao.tencent.com)
- **Google AI Studio** (aistudio.google.com)
- **Grok** (grok.com)
- **Doubao** (doubao.com)

### 🎛️ Core Functionality
- **Intelligent Content Reading**: Automatically reads questions from chat input boxes
- **Built-in Advanced Template**: Premium interactive template for enhanced AI responses
- **One-Click Application**: "Apply Default Template" button for instant template usage
- **Multi-Template Management**: Create, edit, and organize unlimited custom templates
- **Site-Specific Defaults**: Set different default templates for different AI platforms
- **Smart Template Rules**: Support wildcards and priority-based template selection
- **Import/Export**: Backup and share your template collections
- **Bilingual Interface**: Seamless Chinese/English language switching
- **Customizable UI**: Adjustable button position, size, and appearance

### 🔧 Technical Highlights
- **Smart Input Detection**: Advanced input element recognition across all platforms
- **Claude Linebreak Preservation**: Perfect formatting retention for Claude's ProseMirror editor
- **Kimi Optimization**: Specialized handling for Kimi's Lexical editor
- **Shadow DOM Compatibility**: Seamless integration with modern web architectures
- **Template Variable System**: Dynamic `{User Question}` placeholder replacement
- **Concurrent Operation Safety**: Prevents data conflicts during simultaneous operations

## 🚀 Installation

### Prerequisites
Ensure your browser has the [Tampermonkey](https://www.tampermonkey.net/) extension installed.

### Installation Steps
1. Visit the script page: https://greasyfork.org/zh-CN/scripts/545456-prompthelper
2. Click "Install this script"
3. Visit any supported AI platform to start using

## 📖 User Guide

### Interface Overview

After installation, you'll see a blue "Helper" button on supported AI platforms:

![Default Sidebar Button](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P1.png)

### One-Click Template Application

The easiest way to use PromptHelper - simply type your question in the chat input, then click "Apply Default Template":

![One-Click Template Application](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P2.png)

### Main Interface

Click the "Helper" button to access the full control panel with template management:

![Helper Main Interface](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P3.png)

### Multi-Template Selection

Choose from multiple templates or create your own custom templates:

![Multi-Template Selection](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P4.png)

### Advanced Settings

Access comprehensive settings for customization and template management:

![Settings Interface](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P5.png)

Features in settings:
- Set default templates for specific websites
- Customize Helper button position and size
- Import/export template collections
- Configure template rules and priorities

### Template Rules Management

Create sophisticated template rules with wildcard support:

![Template Rules Management](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P6.png)

### Rule Creation Tutorial

Step-by-step guidance for creating custom template rules:

![Rule Creation Tutorial](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/P7.png)

## 📋 Built-in Advanced Template

**Interactive Research Template**: A sophisticated template that combines systematic thinking with web research capabilities. Features audit-grade research methodology, multi-perspective analysis, and citation-backed reasoning chains. Perfect for complex inquiries requiring thorough investigation and evidence-based responses.

## 🎯 Usage Workflow

### Basic Usage
1. **Type your question** in the AI platform's chat input
2. **Click "Apply Default Template"** for instant template application
3. **Send the enhanced prompt** to get better AI responses

### Advanced Usage
1. **Set site-specific defaults** in settings for different AI platforms
2. **Create custom templates** for specialized use cases
3. **Use template rules** with wildcards for automatic template selection
4. **Import/export templates** to share with team members

## 🔍 Template Variables

Use `{User Question}` as a placeholder in template content, which will be automatically replaced with the content from the chat input box.

**Example Template:**
```
Please provide a comprehensive analysis of the following question with evidence-based reasoning:

Question: {User Question}

Please structure your response with:
1. Key insights
2. Supporting evidence
3. Practical implications
```

## 🎨 Interface Design

- **Minimalist Sidebar**: Clean blue button that doesn't interfere with original websites
- **Smart Positioning**: Customizable button placement and sizing
- **Responsive Design**: Adapts to different screen sizes and layouts
- **Theme Compatibility**: Works well with light and dark themes
- **Style Isolation**: Completely isolated CSS prevents conflicts

## 🛠️ Development Information

### Tech Stack
- **Pure JavaScript ES6+**: No external dependencies
- **Tampermonkey API**: Local storage and style injection
- **Advanced DOM Manipulation**: Cross-platform input detection
- **Modern Event Handling**: Optimized for different frameworks

### Core Technical Features
1. **Cross-Platform Compatibility**: Universal input element detection
2. **Framework Support**: React, Angular, Vue, and vanilla JS compatibility
3. **Smart Content Processing**: Intelligent text extraction and injection
4. **Concurrent Operation Safety**: Thread-safe template operations

## 📝 Changelog

### v1.7.0 (Current Version)
**🎯 Major Architecture Upgrade**
- **One-Click Template Application**: New "Apply Default Template" button for instant usage
- **Smart Content Reading**: Automatically reads from chat input instead of separate text box
- **Site-Specific Defaults**: Set different default templates for different AI platforms
- **Template Rules System**: Advanced wildcard support and priority-based selection
- **Enhanced UI**: Redesigned interface with improved usability
- **Import/Export**: Complete template backup and sharing functionality
- **Claude Optimization**: Perfect linebreak preservation for Claude interactions
- **Expanded Platform Support**: Added Grok and Doubao compatibility

## 🛡️ Privacy & Security

- **Local Storage Only**: All data stays in your browser, never uploaded anywhere
- **Open Source**: Complete transparency with GitHub repository
- **Minimal Permissions**: Only uses necessary Tampermonkey privileges
- **No External Dependencies**: Self-contained script with no third-party calls

## 🐛 Issue Reporting

For support or bug reports, please provide:
- **Browser and version**
- **Tampermonkey version**
- **AI platform and URL**
- **Detailed error description**
- **Console error messages** (F12 → Console)

## 📄 License

This project is open source under the [MIT License](https://opensource.org/licenses/MIT).

## 🤝 Contributing

Contributions welcome! You can:
- Report bugs or suggest features
- Submit code improvements
- Improve documentation
- Share usage examples and best practices

## 📞 Contact

- **Author**: Sauterne
- **Project URL**: https://github.com/dongshuyan/PromptHelper
- **Script URL**: https://greasyfork.org/zh-CN/scripts/545456-prompthelper
- **License**: MIT
- **Latest Version**: v1.7.0

---

> **💡 Tip**: PromptHelper makes AI interactions more efficient and effective. Try the one-click template application for immediate improvements to your AI conversations!