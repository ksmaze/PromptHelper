# PromptHelper - Universal AI Assistant Userscript

![Version](https://img.shields.io/badge/Version-1.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-orange)

**Language**: [English](README.md) | [中文](README-zh.md)

A powerful universal userscript that provides unified Prompt template management functionality across multiple mainstream AI platforms. Features a sidebar interface with template management, content replacement, and one-click input, enabling efficient use of preset Prompt templates across various AI platforms.

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

### 🎛️ Core Functionality
- **Template Management**: Create, edit, delete, and save Prompt templates
- **Bilingual Interface**: Support for Chinese/English language switching
- **Dynamic Replacement**: Use `{User Question}` placeholder for dynamic content replacement
- **One-Click Actions**: Support for copying to clipboard and direct input into platform text boxes
- **Local Storage**: Template data automatically saved locally with cross-session persistence

### 🔧 Technical Highlights
- **Shadow DOM Fix**: Automatically converts closed Shadow DOM to open mode
- **Smart Input Detection**: Specialized input element selectors adapted for each platform
- **Claude Linebreak Preservation**: Uses paste method to perfectly maintain linebreaks in Claude's ProseMirror editor
- **Cross-Framework Compatibility**: Supports React, Angular, Vue, and other modern frontend frameworks
- **Precise Event Simulation**: Uses optimal event triggering strategies for different platforms

## 🚀 Installation

### Prerequisites
Ensure your browser has the [Tampermonkey](https://www.tampermonkey.net/) extension installed.

### Installation Steps
1. Copy the `PromptHelper.js` file content
2. Open Tampermonkey dashboard
3. Click "Create a new script"
4. Paste the script content and save
5. Visit any supported AI platform to start using

## 📖 User Guide

### Interface Overview

After installing the script, you'll see a blue "Helper" button on the right side of the page:

![Sidebar Button](pictures/small.png)

Clicking the button expands the full operation panel. The script supports bilingual Chinese/English interface:

**Chinese Interface:**
![Chinese Interface](pictures/big-zh.png)

**English Interface:**
![English Interface](pictures/big-en.png)

### Basic Operations
1. **Open Assistant**: After visiting a supported AI platform, click the "Helper" button on the right side of the page
2. **Switch Language**: Click the "中/En" button in the top-left corner of the panel to switch interface language
3. **Select Template**: Choose from preset or custom templates in the dropdown menu
4. **Input Question**: Enter your specific question in the "Your Question" area
5. **Use Template**:
   - Click "Copy to Clipboard": Copy the final Prompt to system clipboard
   - Click "Fill into Input": Directly fill the Prompt into the platform's input box

### Template Management
- **New Template**: Click "New" button to create a blank template
- **Edit Template**: Select an existing template and modify its name and content
- **Save Template**: Click "Save" button to save changes
- **Delete Template**: Select a template and click "Delete" button (confirmation required)

### Variable Replacement Mechanism
Use `{User Question}` as a placeholder in template content, which will be automatically replaced with the content you enter in the question area at runtime.

**Example Template:**
```
Please provide a clear, structured, and comprehensive answer based on the following question.

User Question:
{User Question}
```

### Quick Start

#### First Time Use
1. After installing the script, visit any supported AI platform
2. Click the "Helper" button on the right side of the page to open the panel
3. Try using the built-in "General Response Template"
4. Enter in the question area: "How to make delicious Italian pasta?"
5. Click "Fill into Input" to experience the one-click fill functionality

#### Advanced Usage
- **Create Custom Templates**: Design specialized Prompt templates based on your work needs
- **Multi-Platform Sync**: Use the same template library across different AI platforms
- **Linebreak Formatting**: Use linebreaks and blank lines in templates to improve Prompt readability

## 📋 Built-in Templates

The script comes with 1 powerful preset template:

**Interactive Research Template**: An advanced template that combines systematic thinking with web research capabilities. Features audit-grade research methodology, multi-perspective analysis, and citation-backed reasoning chains. Perfect for complex inquiries requiring thorough investigation and evidence-based responses.

## 🎨 Interface Design

- **Fixed Sidebar**: Right-side fixed position, doesn't interfere with original website layout
- **Collapsible Design**: Click "×" button to collapse panel, saving screen space
- **Smooth Animation**: Uses CSS3 transition for expand/collapse animations
- **Responsive Layout**: Button groups with adaptive layout supporting different screen sizes
- **Style Isolation**: Completely isolated CSS styles prevent conflicts with original websites

## 🔍 FAQ

### Q: Why do linebreaks disappear after filling content on some platforms?
A: This is due to different editor implementations across platforms. The script has implemented a specialized linebreak preservation mechanism for Claude's ProseMirror editor to ensure complete linebreak format retention.

### Q: Which browsers does the script support?
A: Supports all mainstream browsers (Chrome, Firefox, Edge, Safari), but requires the Tampermonkey extension.

### Q: Will template data be lost?
A: No. All template data is saved in local browser storage unless you manually clear browser data or uninstall the script.

### Q: Can I use it on multiple AI platforms simultaneously?
A: Yes. The script automatically recognizes the current platform and enables corresponding functionality.

## 🛠️ Development Information

### Tech Stack
- **Pure JavaScript ES6+**: No external dependencies
- **Tampermonkey API**: Data storage and style injection
- **CSS3**: Flexbox layout and animation effects
- **DOM API**: Native DOM manipulation and event handling

### Core Technical Features
1. **Shadow DOM Compatibility**: Automatically converts closed shadow DOM to open mode
2. **Cross-Framework Support**: Supports React, Angular, Vue, and other modern frontend frameworks
3. **Smart Input Recognition**: Multi-level input element finding strategy
4. **Event Simulation Optimization**: Uses optimal event sequences for different platforms

### Permission Description
- `GM_setValue` / `GM_getValue`: Local storage for template data and settings
- `GM_addStyle`: Inject custom styles to avoid conflicts with original websites
- `@run-at document-start`: Run Shadow DOM fixes before page loading

## 📝 Changelog

### v1.0 (Current Version)
**🎯 Complete Architecture Redesign**
- **Complete Code Refactor**: Redesigned from scratch based on modern JavaScript standards, improving performance and stability
- **Claude Linebreak Preservation**: Uses paste method to perfectly solve Claude ProseMirror editor linebreak format issues
- **Smart HTML Conversion**: Converts plain text to `<p>` and `<br>` structures, perfectly adapting to rich text editors
- **Shadow DOM Support**: Automatically handles closed Shadow DOM for Gemini and Google AI Studio
- **Precise Platform Adaptation**: Each platform uses specially optimized input element selectors
- **Event Optimization**: Minimizes event triggering, avoiding performance issues and conflicts
- **Universal Platform Compatibility**: Perfect support for 8 major AI platforms

**🔧 Major Technical Breakthroughs**
- **OpenAI Linebreak Protection**: Fixes Chrome kernel ChatGPT textarea linebreak clearing issues
- **React State Management**: Deep integration with React controlled components, solving state update issues for platforms like Tongyi Qianwen
- **Angular Framework Adaptation**: Specialized optimization for Google AI Studio's Angular + Material Design architecture
- **Lexical Editor Support**: Perfect adaptation for Kimi's Lexical rich text editor
- **Multi-Level Fallback Mechanism**: Smart input element finding ensuring normal operation under various page structures

## 🛡️ Privacy & Security

- **Local Storage**: All data is only saved locally in your browser, never uploaded to any server
- **Open Source Transparency**: Code is completely open source, script behavior can be inspected at any time
- **Minimal Permissions**: Only uses necessary Tampermonkey permissions
- **No External Dependencies**: Doesn't rely on any third-party services or libraries

## 🐛 Issue Reporting

If you encounter issues during use, please provide the following information:
- **Browser type and version**
- **Tampermonkey version**
- **Specific AI platform and URL**
- **Error description and reproduction steps**
- **Browser console error messages** (press F12 to view)

## 📄 License

This project is open source under the [MIT License](https://opensource.org/licenses/MIT).

## 🤝 Contributing

Contributions are welcome! You can:
- Report bugs or suggest features
- Submit code improvements or new features
- Improve documentation or add usage examples
- Share your usage experiences and best practices

## 📞 Contact

- **Author**: Sauterne
- **Project URL**: https://github.com/dongshuyan/PromptHelper
- **License**: MIT
- **Latest Version**: v1.0

## 🎯 Interactive Template Example

Here's a demonstration of the built-in Interactive Research Template in action:

### Question Input
![Question Input](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/Q1.png)

### Initial Response
The template guides the AI to perform systematic analysis:
![Initial Response](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/Q2.png)

### Complete Analysis
Final comprehensive response with citations and evidence:
![Complete Analysis](https://github.com/dongshuyan/PromptHelper/blob/master/pictures/Q3.png)

The Interactive Research Template demonstrates:
- **Systematic approach**: Multi-gate verification process
- **Evidence-based reasoning**: Citation-backed conclusions  
- **Thorough investigation**: Web research integration
- **Structured output**: Clear, audit-grade presentation

---

> **💡 Tip**: If you find this script useful, feel free to share it with more friends who might need it!