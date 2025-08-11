// ==UserScript==
// @name         PromptHelper
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  PromptHelper：通用于 ChatGPT, Gemini, Claude, Kimi, DeepSeek, 通义、元宝、Google AI Studio 的侧边模板助手。保留 v7.5 稳定行为；对 Claude 采用“粘贴法”保真换行；修复 OpenAI 出现 <<<...>>> 被解析为 <<>> 的问题（仅 OpenAI 上处理）。
// @author       Sauterne
// @match        http://chat.openai.com/*
// @match        https://chat.openai.com/*
// @match        http://chatgpt.com/*
// @match        https://chatgpt.com/*
// @match        http://gemini.google.com/*
// @match        https://gemini.google.com/*
// @match        http://claude.ai/*
// @match        https://claude.ai/*
// @match        http://demo.fuclaude.com/*
// @match        https://demo.fuclaude.com/*
// @match        http://www.kimi.com/*
// @match        https://www.kimi.com/*
// @match        http://kimi.com/*
// @match        https://kimi.com/*
// @match        http://kimi.moonshot.cn/*
// @match        https://kimi.moonshot.cn/*
// @match        http://chat.deepseek.com/*
// @match        https://chat.deepseek.com/*
// @match        http://www.tongyi.com/*
// @match        https://www.tongyi.com/*
// @match        http://yuanbao.tencent.com/chat/*
// @match        https://yuanbao.tencent.com/chat/*
// @match        http://aistudio.google.com/*
// @match        https://aistudio.google.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- [核心修复] 应对 Closed Shadow DOM ---
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(options) {
        if (options && options.mode === 'closed') {
            options.mode = 'open';
        }
        return originalAttachShadow.call(this, options);
    };

    // === 仅用于 Claude/ProseMirror 的“粘贴法”保真换行 ===
    function escapeHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    // 把纯文本换行转成 <p> 与 <br>；空行用 <p>&nbsp;</p> 保留
    function textToHtmlPreserveBlankLines(text) {
        const lines = text.split('\n');
        const paras = [];
        let buf = [];
        const flush = () => {
            if (!buf.length) return;
            const inner = buf.map(ln => escapeHtml(ln)).join('<br>');
            paras.push(`<p>${inner}</p>`);
            buf = [];
        };
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            if (ln === '') { flush(); paras.push('<p>&nbsp;</p>'); }
            else buf.push(ln);
        }
        flush();
        if (paras.length === 0) paras.push('<p>&nbsp;</p>');
        return paras.join('');
    }
    function pasteIntoProseMirror(editableEl, plainText) {
        const html = textToHtmlPreserveBlankLines(plainText);
        editableEl.focus();
        let ok = false;
        try {
            const dt = new DataTransfer();
            dt.setData('text/plain', plainText);
            dt.setData('text/html', html);
            const evt = new ClipboardEvent('paste', { bubbles:true, cancelable:true, clipboardData: dt });
            ok = editableEl.dispatchEvent(evt);
        } catch (_) { ok = false; }
        if (!ok) {
            try { document.execCommand('insertText', false, plainText); }
            catch (_) {
                editableEl.textContent = '';
                editableEl.dispatchEvent(new Event('input', { bubbles: true }));
                editableEl.textContent = plainText;
                editableEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
    // === 仅上面三函数是新增；其余保持 v7.5 原样 ===

    // --- 脚本主体逻辑 ---
    window.addEventListener('DOMContentLoaded', () => {

        // --- 网站配置 ---
        const siteConfigs = {
            'openai.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea' },
            'chatgpt.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea' },
            'gemini.google.com': {
                name: 'Gemini',
                shadowRootSelector: 'chat-app',
                inputSelector: 'div.initial-input-area textarea, rich-textarea .ql-editor, [contenteditable="true"][role="textbox"]'
            },
            'claude.ai': { name: 'Claude', inputSelector: '.ProseMirror[contenteditable="true"]' },
            'fuclaude.com': { name: 'Claude', inputSelector: '.ProseMirror[contenteditable="true"]' },
            // 兼容新老 Kimi 域名
            'kimi.com': {
                name: 'Kimi',
                inputSelector: 'div.chat-input-editor[data-lexical-editor="true"], div[contenteditable="true"], textarea, [role="textbox"], [data-lexical-editor]'
            },
            'kimi.moonshot.cn': {
                name: 'Kimi',
                inputSelector: 'div.chat-input-editor[data-lexical-editor="true"], div[contenteditable="true"], textarea, [role="textbox"], [data-lexical-editor]'
            },
            'deepseek.com': {
                name: 'DeepSeek',
                inputSelector: 'textarea[placeholder*="随便聊点什么"], textarea[placeholder*="Ask me anything"], div[contenteditable="true"], #chat-input, [role="textbox"]'
            },
            'tongyi.com': {
                name: '通义',
                inputSelector: 'textarea[placeholder*="有问题，随时问通义"], textarea[placeholder*="问题"], textarea, div[contenteditable="true"], [role="textbox"]'
            },
            'yuanbao.tencent.com': {
                name: '腾讯元宝',
                inputSelector: 'textarea[placeholder*="输入问题"], textarea[placeholder*="问题"], textarea, div[contenteditable="true"], [role="textbox"]'
            },
            'aistudio.google.com': {
                name: 'Google AI Studio',
                shadowRootSelector: 'app-root',
                inputSelector: '[contenteditable="true"], textarea, [role="textbox"], [aria-label*="prompt"], [aria-label*="Prompt"], [placeholder*="prompt"], [placeholder*="Prompt"], .prompt-input, #prompt-input, input[type="text"]'
            }
        };

        // --- 默认的 Prompt 模板 ---
        const defaultPrompts = {
            "prompt_1": { name: "通用回答模板", template: `请基于以下问题，提供一个清晰、结构化且全面的回答。\n\n用户问题：\n{User Question}` },
            "prompt_2": { name: "代码评审模板", template: `我是一名软件工程师，请帮我评审以下代码。我希望你关注代码的可读性、性能、潜在的 bug 和最佳实践。请用中文提供具体的改进建议。\n\n以下是我的代码：\n\`\`\`\n{User Question}\n\`\`\`` },
            "prompt_3": { name: "英文润色模板", template: `Please act as an English polisher. Your task is to refine the following text, improving its grammar, clarity, and style while preserving the original meaning. Please provide the polished version directly without any explanation unless I ask for it.\n\nOriginal text:\n"{User Question}"` }
        };

        // --- 国际化文本（按钮保留“Helper”，标题保持“PromptHelper”） ---
        const translations = {
            zh: {
                toggleButton: "Helper", panelTitle: "PromptHelper", collapseTitle: "收起", selectTemplate: "选择模板", newBtn: "新建",
                saveBtn: "保存", deleteBtn: "删除", templateName: "模板名称", templateNamePlaceholder: "为您的模板命名",
                templateContent: "模板内容 (使用 {User Question} 作为占位符)", yourQuestion: "您的问题",
                yourQuestionPlaceholder: "在此输入您的具体问题...", copyBtn: "复制到剪贴板", copiedBtn: "已复制！",
                submitBtn: "填入提问栏", selectDefault: "-- 选择一个模板 --", alertSaveSuccess: "模板已保存！",
                alertSaveError: "模板名称和内容不能为空！", alertDeleteConfirm: "确定要删除模板",
                alertDeleteError: "请先选择一个要删除的模板！", alertCopyError: "复制失败，请查看控制台。",
                alertSubmitError: "未找到当前网站的输入框。", alertTemplateError: "请先选择或创建一个模板！"
            },
            en: {
                toggleButton: "Helper", panelTitle: "PromptHelper", collapseTitle: "Collapse", selectTemplate: "Select Template", newBtn: "New",
                saveBtn: "Save", deleteBtn: "Delete", templateName: "Template Name", templateNamePlaceholder: "Name your template",
                templateContent: "Template Content (use {User Question} as placeholder)", yourQuestion: "Your Question",
                yourQuestionPlaceholder: "Enter your specific question here...", copyBtn: "Copy to Clipboard", copiedBtn: "Copied!",
                submitBtn: "Fill into Input", selectDefault: "-- Select a template --", alertSaveSuccess: "Template saved!",
                alertSaveError: "Template name and content cannot be empty!", alertDeleteConfirm: "Are you sure you want to delete the template",
                alertDeleteError: "Please select a template to delete first!", alertCopyError: "Failed to copy. See console for details.",
                alertSubmitError: "Could not find the input box for the current site.", alertTemplateError: "Please select or create a template first!"
            }
        };

        let currentLang = GM_getValue('universal_prompt_helper_lang', 'zh');

        function injectStyles() {
            GM_addStyle(`
                /* 增强的样式隔离，防止第三方CSS干扰 */
                #prompt-helper-container { all: initial !important; }
                #prompt-helper-container *, #prompt-helper-container *::before, #prompt-helper-container *::after {
                    all: unset !important;
                    box-sizing: border-box !important;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    text-decoration: none !important;
                    border: none !important;
                    outline: none !important;
                }
                #prompt-helper-container { position: fixed !important; top: 100px !important; right: 0 !important; z-index: 99999 !important; font-size: 16px !important; color: #333 !important; line-height: 1.5 !important; }
                #prompt-helper-toggle { width: 40px !important; height: 100px !important; background-color: #007bff !important; color: white !important; border: none !important; border-radius: 10px 0 0 10px !important; cursor: pointer !important; writing-mode: vertical-rl !important; text-orientation: mixed !important; display: flex !important; align-items: center !important; justify-content: center !important; font-size: 16px !important; box-shadow: -2px 2px 5px rgba(0,0,0,0.2) !important; }
                #prompt-helper-content { position: absolute !important; top: 0 !important; right: 40px !important; width: 400px !important; background-color: #f8f9fa !important; border: 1px solid #dee2e6 !important; border-radius: 8px !important; box-shadow: -2px 2px 10px rgba(0,0,0,0.1) !important; padding: 15px !important; display: flex !important; flex-direction: column !important; gap: 15px !important; transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out !important; color: #333 !important; text-align: left !important; }
                #prompt-helper-content.hidden { transform: translateX(100%) !important; opacity: 0 !important; pointer-events: none !important; }
                #prompt-helper-content h3 { padding: 0 !important; font-size: 18px !important; color: #343a40 !important; text-align: center !important; font-weight: bold !important; }
                #prompt-helper-content .ph-section { display: flex !important; flex-direction: column !important; gap: 8px !important; }
                #prompt-helper-content label { font-weight: bold !important; color: #495057 !important; font-size: 14px !important; }
                #prompt-helper-content select, #prompt-helper-content input, #prompt-helper-content textarea { width: 100% !important; padding: 8px !important; border: 1px solid #ced4da !important; border-radius: 4px !important; font-size: 14px !important; color: #333 !important; background-color: #fff !important; line-height: 1.5 !important; }
                #prompt-helper-content textarea { resize: vertical !important; min-height: 100px !important; }
                #prompt-helper-content #ph-template-body { height: 150px !important; }
                #prompt-helper-content #ph-user-question { height: 80px !important; }
                #prompt-helper-content .ph-button-group { display: flex !important; gap: 10px !important; justify-content: space-between !important; }
                #prompt-helper-content .ph-button-group button { flex-grow: 1 !important; }
                #prompt-helper-content button { padding: 10px !important; border-radius: 5px !important; border: none !important; cursor: pointer !important; font-size: 14px !important; font-weight: bold !important; transition: background-color 0.2s, color 0.2s !important; color: white !important; }
                #prompt-helper-content button:disabled { cursor: not-allowed !important; opacity: 0.7 !important; }
                #prompt-helper-container .ph-btn-primary { background-color: #007bff !important; } #prompt-helper-container .ph-btn-primary:hover { background-color: #0056b3 !important; }
                #prompt-helper-container .ph-btn-secondary { background-color: #6c757d !important; } #prompt-helper-container .ph-btn-secondary:hover { background-color: #5a6268 !important; }
                #prompt-helper-container .ph-btn-success { background-color: #28a745 !important; } #prompt-helper-container .ph-btn-success:hover { background-color: #218838 !important; }
                #prompt-helper-container .ph-btn-danger { background-color: #dc3545 !important; } #prompt-helper-container .ph-btn-danger:hover { background-color: #c82333 !important; }
                #prompt-helper-container .ph-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 10px !important; padding: 0 !important; }
                #prompt-helper-container #ph-collapse-btn { font-size: 24px !important; cursor: pointer !important; color: #6c757d !important; border: none !important; background: none !important; padding: 0 5px !important; line-height: 1 !important; }
                #prompt-helper-container #ph-lang-toggle { font-size: 12px !important; color: #007bff !important; background: none !important; border: 1px solid #007bff !important; padding: 2px 6px !important; border-radius: 4px !important; cursor: pointer !important; }
            `);
        }

        function buildUI() {
            const create = (tag, id, classes = [], attributes = {}, children = []) => {
                const el = document.createElement(tag);
                if (id) el.id = id;
                if (classes.length) el.classList.add(...classes);
                for (const key in attributes) el.setAttribute(key, attributes[key]);
                for (const child of children) el.appendChild(child);
                return el;
            };

            const D = {};
            const container = create('div', 'prompt-helper-container');

            D.toggleButton = create('button', 'prompt-helper-toggle');
            D.contentPanel = create('div', 'prompt-helper-content', ['hidden']);
            D.langToggleButton = create('button', 'ph-lang-toggle', [], {}, [document.createTextNode('中/En')]);
            D.title = create('h3', 'ph-title');
            D.collapseButton = create('button', 'ph-collapse-btn');
            const header = create('div', 'ph-header', ['ph-header'], {}, [D.langToggleButton, D.title, D.collapseButton]);
            D.labelSelect = create('label', 'ph-label-select', [], { for: 'ph-template-select' });
            D.templateSelect = create('select', 'ph-template-select');
            D.newBtn = create('button', 'ph-new-btn', ['ph-btn-primary']);
            D.saveBtn = create('button', 'ph-save-btn', ['ph-btn-success']);
            D.deleteBtn = create('button', 'ph-delete-btn', ['ph-btn-danger']);
            const section1 = create('div', null, ['ph-section'], {}, [ D.labelSelect, D.templateSelect, create('div', null, ['ph-button-group'], {}, [D.newBtn, D.saveBtn, D.deleteBtn]) ]);
            D.labelName = create('label', 'ph-label-name', [], { for: 'ph-template-name' });
            D.templateNameInput = create('input', 'ph-template-name', [], { type: 'text' });
            D.labelContent = create('label', 'ph-label-content', [], { for: 'ph-template-body' });
            D.templateBodyTextarea = create('textarea', 'ph-template-body');
            const section2 = create('div', null, ['ph-section'], {}, [D.labelName, D.templateNameInput, D.labelContent, D.templateBodyTextarea]);
            D.labelQuestion = create('label', 'ph-label-question', [], { for: 'ph-user-question' });
            D.userQuestionTextarea = create('textarea', 'ph-user-question');
            const section3 = create('div', null, ['ph-section'], {}, [D.labelQuestion, D.userQuestionTextarea]);
            D.copyBtn = create('button', 'ph-copy-btn', ['ph-btn-secondary']);
            D.submitBtn = create('button', 'ph-submit-btn', ['ph-btn-primary']);
            const section4 = create('div', null, ['ph-section'], {}, [ create('div', null, ['ph-button-group'], {}, [D.copyBtn, D.submitBtn]) ]);
            D.contentPanel.append(header, section1, section2, section3, section4);
            container.append(D.toggleButton, D.contentPanel);
            return { container, elements: D };
        }

        function findInputElement() {
            const siteConfig = getCurrentSiteConfig();
            if (!siteConfig) {
                console.log('[PromptHelper] 未找到当前网站配置');
                return null;
            }

            console.log(`[PromptHelper] 正在查找 ${window.location.hostname} 的输入元素...`);
            console.log(`[PromptHelper] 使用选择器: ${siteConfig.inputSelector}`);

            // 增强的输入元素查找逻辑
            let inputElement = null;

            // 1. 先尝试 Shadow DOM 查找
            if (siteConfig.shadowRootSelector) {
                const host = document.querySelector(siteConfig.shadowRootSelector);
                if (host && host.shadowRoot) {
                    const elementInShadow = host.shadowRoot.querySelector(siteConfig.inputSelector);
                    if (elementInShadow) inputElement = elementInShadow;
                }
            }

            // 2. 如果没有找到，尝试正常 DOM 查找
            if (!inputElement) {
                const selectors = siteConfig.inputSelector.split(',').map(s => s.trim());
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (!element.closest('#prompt-helper-container')) {
                            inputElement = element;
                            break;
                        }
                    }
                    if (inputElement) break;
                }
            }

            // 3. Google AI Studio 回退
            if (!inputElement && window.location.hostname.includes('aistudio.google.com')) {
                const aiStudioSelectors = [
                    '[contenteditable="true"]','textarea','[role="textbox"]','[aria-label*="prompt"]','[aria-label*="Prompt"]','[aria-label*="message"]','[aria-label*="Message"]','[placeholder*="prompt"]','[placeholder*="Prompt"]','[placeholder*="message"]','[placeholder*="Message"]','[data-testid*="prompt"]','[data-testid*="input"]','.prompt-input','.chat-input','.message-input','input[type="text"]','div[spellcheck="true"]','[data-lexical-editor]','.editor-input'
                ];
                for (const selector of aiStudioSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (!element.closest('#prompt-helper-container')) {
                            const style = window.getComputedStyle(element);
                            const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                            const isEditable = !element.disabled && !element.readOnly &&
                                (element.contentEditable === 'true' || element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input');
                            if (isVisible && isEditable) { inputElement = element; break; }
                        }
                    }
                    if (inputElement) break;
                }
            }

            // 4. DeepSeek 回退
            if (!inputElement && window.location.hostname.includes('deepseek.com')) {
                const fallbackSelectors = [
                    'textarea','[contenteditable="true"]','[role="textbox"]','input[type="text"]','.chat-input','[data-placeholder]','[aria-label*="输入"]','[aria-label*="input"]','[placeholder*="聊"]','[placeholder*="chat"]'
                ];
                for (const selector of fallbackSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (!element.closest('#prompt-helper-container')) {
                            const style = window.getComputedStyle(element);
                            if (style.display !== 'none' && style.visibility !== 'hidden' && !element.disabled && !element.readOnly) {
                                inputElement = element; break;
                            }
                        }
                    }
                    if (inputElement) break;
                }
            }

            if (inputElement) {
                console.log('[PromptHelper] 成功找到输入元素:', {
                    tagName: inputElement.tagName,
                    className: inputElement.className,
                    id: inputElement.id,
                    placeholder: inputElement.placeholder,
                    contentEditable: inputElement.contentEditable,
                    element: inputElement
                });
            } else {
                console.log('[PromptHelper] 未找到输入元素');
                const allInputs = document.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]');
                allInputs.forEach((el, index) => {
                    console.log(`[PromptHelper] 候选元素 ${index + 1}:`, {
                        tagName: el.tagName,
                        className: el.className,
                        id: el.id,
                        placeholder: el.placeholder,
                        contentEditable: el.contentEditable,
                        isVisible: window.getComputedStyle(el).display !== 'none',
                        element: el
                    });
                });
            }
            return inputElement;
        }

        function init() {
            if (document.getElementById('prompt-helper-container')) return;
            if (window.promptHelperInitialized) return;
            window.promptHelperInitialized = true;

            injectStyles();
            const { container, elements: D } = buildUI();

            // 安全挂载
            const addToDOM = () => {
                if (document.body) {
                    document.body.appendChild(container);
                } else {
                    setTimeout(addToDOM, 100);
                }
            };
            addToDOM();

            let prompts = {};

            const updateUI = () => {
                const t = translations[currentLang];
                D.toggleButton.textContent = t.toggleButton; D.title.textContent = t.panelTitle;
                D.collapseButton.title = t.collapseTitle; D.collapseButton.textContent = '\u00d7';
                D.labelSelect.textContent = t.selectTemplate;
                D.newBtn.textContent = t.newBtn; D.saveBtn.textContent = t.saveBtn; D.deleteBtn.textContent = t.deleteBtn;
                D.labelName.textContent = t.templateName; D.templateNameInput.placeholder = t.templateNamePlaceholder;
                D.labelContent.textContent = t.templateContent;
                D.labelQuestion.textContent = t.yourQuestion; D.userQuestionTextarea.placeholder = t.yourQuestionPlaceholder;
                D.copyBtn.textContent = t.copyBtn; D.submitBtn.textContent = t.submitBtn;
                populateDropdown(); displaySelectedPrompt();
            };

            const loadPrompts = () => {
                const savedPrompts = GM_getValue('universal_prompt_helper_prompts', null);
                prompts = savedPrompts ? JSON.parse(savedPrompts) : defaultPrompts;
                if (!savedPrompts) savePrompts();
                updateUI();
            };

            const savePrompts = () => GM_setValue('universal_prompt_helper_prompts', JSON.stringify(prompts));

            const populateDropdown = () => {
                const currentSelection = D.templateSelect.value;
                D.templateSelect.textContent = '';
                const defaultOption = document.createElement('option');
                defaultOption.value = ''; defaultOption.textContent = translations[currentLang].selectDefault;
                D.templateSelect.appendChild(defaultOption);
                for (const id in prompts) {
                    const option = document.createElement('option');
                    option.value = id; option.textContent = prompts[id].name;
                    D.templateSelect.appendChild(option);
                }
                if (prompts[currentSelection]) D.templateSelect.value = currentSelection;
            };

            const displaySelectedPrompt = () => {
                const selectedId = D.templateSelect.value;
                if (selectedId && prompts[selectedId]) {
                    D.templateNameInput.value = prompts[selectedId].name;
                    D.templateBodyTextarea.value = prompts[selectedId].template;
                } else { D.templateNameInput.value = ''; D.templateBodyTextarea.value = ''; }
            };

            const generateFinalPrompt = () => {
                const template = D.templateBodyTextarea.value;
                const question = D.userQuestionTextarea.value;
                if (!template) { alert(translations[currentLang].alertTemplateError); return null; }
                return template.replace('{User Question}', question);
            };

            D.toggleButton.addEventListener('click', () => D.contentPanel.classList.remove('hidden'));
            D.collapseButton.addEventListener('click', () => D.contentPanel.classList.add('hidden'));
            D.langToggleButton.addEventListener('click', () => {
                currentLang = currentLang === 'zh' ? 'en' : 'zh';
                GM_setValue('universal_prompt_helper_lang', currentLang);
                updateUI();
            });
            D.templateSelect.addEventListener('change', displaySelectedPrompt);
            D.newBtn.addEventListener('click', () => {
                D.templateSelect.value = ''; D.templateNameInput.value = ''; D.templateBodyTextarea.value = ''; D.templateNameInput.focus();
            });
            D.saveBtn.addEventListener('click', () => {
                const name = D.templateNameInput.value.trim();
                const template = D.templateBodyTextarea.value.trim();
                if (!name || !template) { alert(translations[currentLang].alertSaveError); return; }
                let selectedId = D.templateSelect.value || `prompt_${Date.now()}`;
                prompts[selectedId] = { name, template };
                savePrompts(); populateDropdown(); D.templateSelect.value = selectedId;
                alert(`${translations[currentLang].alertSaveSuccess} "${name}"`);
            });
            D.deleteBtn.addEventListener('click', () => {
                const selectedId = D.templateSelect.value;
                if (!selectedId) { alert(translations[currentLang].alertDeleteError); return; }
                if (confirm(`${translations[currentLang].alertDeleteConfirm} "${prompts[selectedId].name}"?`)) {
                    delete prompts[selectedId]; savePrompts(); populateDropdown(); displaySelectedPrompt();
                }
            });
            D.copyBtn.addEventListener('click', () => {
                const finalPrompt = generateFinalPrompt();
                if (finalPrompt) {
                    navigator.clipboard.writeText(finalPrompt).then(() => {
                        const originalText = D.copyBtn.textContent;
                        D.copyBtn.textContent = translations[currentLang].copiedBtn; D.copyBtn.disabled = true;
                        setTimeout(() => { D.copyBtn.textContent = originalText; D.copyBtn.disabled = false; }, 2000);
                    }).catch(err => { console.error('Copy failed:', err); alert(translations[currentLang].alertCopyError); });
                }
            });
            D.submitBtn.addEventListener('click', () => {
                const finalPrompt = generateFinalPrompt();
                if (!finalPrompt) return;
                const inputElement = findInputElement();
                if (inputElement) {
                    console.log('[PromptHelper] 找到输入元素:', {
                        tagName: inputElement.tagName,
                        className: inputElement.className,
                        id: inputElement.id,
                        placeholder: inputElement.placeholder,
                        contentEditable: inputElement.contentEditable,
                        type: inputElement.type,
                        element: inputElement
                    });

                    // === v7.5 的逻辑：textarea 路径 ===
                    if (inputElement.tagName.toLowerCase() === 'textarea') {
                        if (window.location.hostname.includes('tongyi.com')) {
                            // —— 通义千问：保持 v7.5 原逻辑（React 受控组件）
                            const reactKey = Object.keys(inputElement).find(key =>
                                key.startsWith('__reactInternalInstance') ||
                                key.startsWith('__reactFiber') ||
                                key.startsWith('__reactProps')
                            );

                            if (reactKey) {
                                try {
                                    const fiberNode = inputElement[reactKey];
                                    const possiblePaths = [
                                        fiberNode?.memoizedProps?.onChange,
                                        fiberNode?.return?.memoizedProps?.onChange,
                                        fiberNode?.return?.return?.memoizedProps?.onChange,
                                        fiberNode?.pendingProps?.onChange
                                    ];
                                    for (const onChange of possiblePaths) {
                                        if (onChange && typeof onChange === 'function') {
                                            const fakeEvent = {
                                                target: { value: finalPrompt },
                                                currentTarget: { value: finalPrompt },
                                                preventDefault: () => {},
                                                stopPropagation: () => {}
                                            };
                                            onChange(fakeEvent);
                                            break;
                                        }
                                    }
                                } catch (e) {
                                    console.log('[PromptHelper] React状态操作失败:', e);
                                }
                            }

                            inputElement.focus();
                            inputElement.value = '';
                            inputElement.value = finalPrompt;
                            Object.defineProperty(inputElement, 'value', {
                                value: finalPrompt, writable: true, configurable: true
                            });

                            const events = [
                                new Event('focus', { bubbles: true }),
                                new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: finalPrompt, inputType: 'insertText' }),
                                new InputEvent('input', { bubbles: true, cancelable: true, data: finalPrompt, inputType: 'insertText' }),
                                new Event('change', { bubbles: true }),
                                new KeyboardEvent('keydown', { bubbles: true, key: 'a' }),
                                new KeyboardEvent('keyup', { bubbles: true, key: 'a' }),
                                new Event('blur', { bubbles: true })
                            ];
                            events.forEach((ev, i) => setTimeout(() => inputElement.dispatchEvent(ev), i * 10));

                            setTimeout(() => {
                                if (inputElement.value !== finalPrompt) {
                                    inputElement.value = finalPrompt;
                                }
                                inputElement.blur();
                                setTimeout(() => {
                                    inputElement.focus();
                                    inputElement.value = finalPrompt;
                                    inputElement.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: finalPrompt, inputType: 'insertText' }));
                                    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                                    inputElement.dispatchEvent(new Event('propertychange', { bubbles: true }));
                                    window.dispatchEvent(new Event('resize'));
                                }, 50);
                            }, 150);

                        } else {
                            // —— OpenAI ChatGPT：保留 v7.5 的“换行保护”逻辑
                            if ((window.location.hostname.includes('openai.com') || window.location.hostname.includes('chatgpt.com'))) {
                                inputElement.value = finalPrompt;
                                const isChrome = navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Firefox');
                                if (isChrome) {
                                    setTimeout(() => {
                                        inputElement.focus();
                                        inputElement.value = finalPrompt;
                                        if (typeof inputElement.setSelectionRange === 'function') {
                                            inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length);
                                        }
                                        const inputEvent = new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText' });
                                        inputElement.dispatchEvent(inputEvent);

                                        let protectionCount = 0;
                                        const protectTextareaContent = () => {
                                            if (protectionCount < 20) {
                                                const currentValue = inputElement.value;
                                                if (currentValue.replace(/\n/g, '') === finalPrompt.replace(/\n/g, '') &&
                                                    !currentValue.includes('\n') &&
                                                    finalPrompt.includes('\n')) {
                                                    inputElement.value = finalPrompt;
                                                    if (typeof inputElement.setSelectionRange === 'function') {
                                                        inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length);
                                                    }
                                                    const restoreEvent = new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText' });
                                                    inputElement.dispatchEvent(restoreEvent);
                                                }
                                                protectionCount++;
                                                setTimeout(protectTextareaContent, 100);
                                            }
                                        };
                                        setTimeout(protectTextareaContent, 100);
                                    }, 50);
                                } else {
                                    const resizeEvent = new Event('input', { bubbles: true });
                                    inputElement.dispatchEvent(resizeEvent);
                                    if (typeof inputElement.setSelectionRange === 'function') {
                                        inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length);
                                    }
                                }
                            } else {
                                inputElement.value = finalPrompt;
                            }

                            // DeepSeek 的 textarea + div 架构（保留 v7.5）
                            if (window.location.hostname.includes('deepseek.com')) {
                                const parentDiv = inputElement.parentElement;
                                if (parentDiv) {
                                    let displayDiv = parentDiv.querySelector('.b13855df');
                                    if (!displayDiv) {
                                        const allDivs = parentDiv.querySelectorAll('div');
                                        for (const div of allDivs) {
                                            if (!div.classList.contains('_24fad49') && div !== parentDiv) { displayDiv = div; break; }
                                        }
                                    }
                                    if (displayDiv) {
                                        displayDiv.innerHTML = '';
                                        const lines = finalPrompt.split('\n');
                                        lines.forEach((line, index) => {
                                            if (index > 0) displayDiv.appendChild(document.createElement('br'));
                                            displayDiv.appendChild(document.createTextNode(line));
                                        });
                                    }
                                }
                            }
                        }

                    // === contenteditable 路径 ===
                    } else if (inputElement.getAttribute('contenteditable') === 'true') {
                        // —— Claude / fuclaude：仅这里改为“粘贴法”以保真换行
                        if (window.location.hostname.includes('claude.ai') || window.location.hostname.includes('fuclaude.com')) {
                            pasteIntoProseMirror(inputElement, finalPrompt);

                            // 轻触发事件 + 将光标移到末尾（不做额外复杂改动）
                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                            try {
                                const range = document.createRange();
                                const sel = window.getSelection();
                                range.selectNodeContents(inputElement);
                                range.collapse(false);
                                sel.removeAllRanges();
                                sel.addRange(range);
                            } catch (_){}
                        } else {
                            // —— 其它 contenteditable：继续使用 v7.5 的处理
                            console.log('[PromptHelper] contenteditable元素处理');

                            if (window.location.hostname.includes('claude.ai') ||
                                window.location.hostname.includes('fuclaude.com') ||
                                window.location.hostname.includes('openai.com') ||
                                window.location.hostname.includes('chatgpt.com')) {
                                // ProseMirror 保持换行（v7.5 的方式）
                                console.log('[PromptHelper] 应用ProseMirror换行保持处理');
                                inputElement.innerHTML = '';

                                const lines = finalPrompt.split('\n');
                                lines.forEach((line, index) => {
                                    if (index > 0) inputElement.appendChild(document.createElement('br'));
                                    if (line.length > 0) inputElement.appendChild(document.createTextNode(line));
                                    else if (index < lines.length - 1) inputElement.appendChild(document.createElement('br'));
                                });

                                const isChrome = navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Firefox');
                                if (isChrome) {
                                    // *** 仅在 OpenAI/ChatGPT 上对 innerHTML 写入做转义，防止 <<<...>>> 被当作标签剔除 ***
                                    const needEscape = (window.location.hostname.includes('openai.com') || window.location.hostname.includes('chatgpt.com'));
                                    const htmlWithBreaks = needEscape
                                        ? escapeHtml(finalPrompt).replace(/\n/g, '<br>')
                                        : finalPrompt.replace(/\n/g, '<br>');

                                    setTimeout(() => {
                                        inputElement.focus();
                                        inputElement.innerHTML = htmlWithBreaks;

                                        const range = document.createRange();
                                        const selection = window.getSelection();
                                        range.selectNodeContents(inputElement);
                                        range.collapse(false);
                                        selection.removeAllRanges();
                                        selection.addRange(range);

                                        const inputEvent = new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertFromPaste' });
                                        inputElement.dispatchEvent(inputEvent);

                                        let protectionCount = 0;
                                        const protectContent = () => {
                                            if (protectionCount < 20) {
                                                const currentHtml = inputElement.innerHTML;
                                                const currentText = inputElement.textContent || inputElement.innerText;
                                                if (currentText.replace(/\n/g, '') === finalPrompt.replace(/\n/g, '') &&
                                                    !currentHtml.includes('<br>') &&
                                                    finalPrompt.includes('\n')) {
                                                    inputElement.innerHTML = htmlWithBreaks;
                                                    try {
                                                        const r = document.createRange();
                                                        const s = window.getSelection();
                                                        r.selectNodeContents(inputElement);
                                                        r.collapse(false);
                                                        s.removeAllRanges();
                                                        s.addRange(r);
                                                    } catch (_){}
                                                }
                                                protectionCount++;
                                                setTimeout(protectContent, 100);
                                            }
                                        };
                                        setTimeout(protectContent, 100);
                                    }, 50);
                                }
                            } else {
                                // 其它简单 contenteditable
                                inputElement.textContent = finalPrompt;
                            }
                        }

                    } else {
                        // 其他输入类型兜底（保持 v7.5）
                        if ('value' in inputElement) {
                            inputElement.value = finalPrompt;
                        }
                        if (inputElement.textContent !== undefined) {
                            inputElement.textContent = finalPrompt;
                        }
                        if (inputElement.innerText !== undefined) {
                            inputElement.innerText = finalPrompt;
                        }
                    }

                    // === 通用事件触发（保持 v7.5；不使用外部未定义变量）===
                    const events = ['input', 'change', 'keydown', 'keyup', 'paste'];
                    events.forEach(eventType => {
                        const event = new Event(eventType, { bubbles: true, cancelable: true });
                        inputElement.dispatchEvent(event);
                    });

                    const inputEvent = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        data: finalPrompt,
                        inputType: 'insertText'
                    });
                    inputElement.dispatchEvent(inputEvent);

                    // DeepSeek 键盘/合成事件（保留 v7.5）
                    if (window.location.hostname.includes('deepseek.com')) {
                        ['keydown', 'keypress', 'keyup'].forEach(eventType => {
                            const keyEvent = new KeyboardEvent(eventType, {
                                bubbles: true, cancelable: true, key: 'a', code: 'KeyA', which: 65, keyCode: 65
                            });
                            inputElement.dispatchEvent(keyEvent);
                        });
                        inputElement.dispatchEvent(new Event('compositionstart', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('compositionupdate', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('compositionend', { bubbles: true }));
                    }

                    // 聚焦与光标（保持 v7.5）
                    inputElement.focus();
                    if (inputElement.tagName.toLowerCase() === 'textarea' || inputElement.type === 'text') {
                        try { inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length); } catch (_) {}
                    } else if (inputElement.getAttribute('contenteditable') === 'true') {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        if (sel && inputElement.childNodes.length > 0) {
                            range.selectNodeContents(inputElement);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }

                    // 轻微延迟再触发（保持 v7.5）
                    setTimeout(() => {
                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

                        // 特殊站点延迟检查（仅状态检查，不重复设置）
                        const specialSites = ['deepseek.com', 'kimi.moonshot.cn', 'kimi.com', 'www.kimi.com', 'tongyi.com', 'yuanbao.tencent.com'];
                        const currentSiteCheck = specialSites.find(site => window.location.hostname.includes(site));
                        if (currentSiteCheck) {
                            console.log(`[PromptHelper] 延迟检查 ${currentSiteCheck} 状态`);
                        }
                    }, 100);

                    // 额外同步检查（保持 v7.5）
                    const specialSites = ['deepseek.com', 'kimi.moonshot.cn', 'kimi.com', 'www.kimi.com', 'tongyi.com', 'yuanbao.tencent.com', 'aistudio.google.com'];
                    const currentSite = specialSites.find(site => window.location.hostname.includes(site));
                    if (currentSite) {
                        const skipComplexProcessing = (currentSite === 'kimi.moonshot.cn' || currentSite === 'kimi.com' || currentSite === 'www.kimi.com')
                            && inputElement.getAttribute('contenteditable') === 'true';
                        if (!skipComplexProcessing) {
                            setTimeout(() => {
                                const parentDiv = inputElement.parentElement;
                                if (parentDiv) {
                                    inputElement.blur();
                                    setTimeout(() => {
                                        inputElement.focus();
                                        try {
                                            if (inputElement.tagName.toLowerCase() === 'textarea' || inputElement.type === 'text') {
                                                inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length);
                                            }
                                        } catch (_) {}
                                    }, 50);
                                    window.dispatchEvent(new Event('resize'));

                                    // —— React 受控组件：onChange 兜底（保持 v7.5 思路）
                                    const reactKey = Object.keys(inputElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
                                    if (reactKey) {
                                        try {
                                            const fiberNode = inputElement[reactKey];
                                            if (fiberNode && fiberNode.memoizedProps && typeof fiberNode.memoizedProps.onChange === 'function') {
                                                const fakeEvent = {
                                                    target: { value: finalPrompt },
                                                    currentTarget: { value: finalPrompt },
                                                    preventDefault: () => {},
                                                    stopPropagation: () => {}
                                                };
                                                fiberNode.memoizedProps.onChange(fakeEvent);
                                            }
                                        } catch (e) {
                                            console.log(`[PromptHelper] ${currentSite} React状态更新失败:`, e);
                                        }
                                    }

                                    // —— 站点定制（保持 v7.5）
                                    if (currentSite === 'tongyi.com') {
                                        inputElement.focus();
                                        inputElement.value = '';
                                        const txt = finalPrompt;
                                        for (let i = 0; i < txt.length; i++) {
                                            const ch = txt[i];
                                            inputElement.value += ch;
                                            const seq = [
                                                new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ch }),
                                                new InputEvent('input', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }),
                                                new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: ch })
                                            ];
                                            seq.forEach(ev => inputElement.dispatchEvent(ev));
                                        }
                                        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                                        inputElement.dispatchEvent(new Event('blur', { bubbles: true }));
                                        setTimeout(() => inputElement.focus(), 50);
                                    } else if (currentSite === 'yuanbao.tencent.com') {
                                        inputElement.setAttribute('value', finalPrompt);
                                    } else if (currentSite === 'aistudio.google.com') {
                                        const angularKey = Object.keys(inputElement).find(key =>
                                            key.startsWith('__ngContext') ||
                                            key.startsWith('__ng') ||
                                            key.includes('angular')
                                        );
                                        if (angularKey) {
                                            try {
                                                const ngZone = window.ng?.getComponent?.(inputElement);
                                                if (ngZone) {
                                                    ngZone.run(() => {
                                                        inputElement.value = finalPrompt;
                                                        if (inputElement.textContent !== undefined) inputElement.textContent = finalPrompt;
                                                    });
                                                }
                                            } catch (e) {
                                                console.log('[PromptHelper] Angular状态操作失败:', e);
                                            }
                                        }
                                        if (inputElement.getAttribute('contenteditable') === 'true') {
                                            inputElement.innerHTML = '';
                                            finalPrompt.split('\n').forEach((line, idx) => {
                                                if (idx > 0) inputElement.appendChild(document.createElement('br'));
                                                inputElement.appendChild(document.createTextNode(line));
                                            });
                                        }
                                        [ new Event('focus', { bubbles: true }),
                                          new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' }),
                                          new Event('change', { bubbles: true }),
                                          new Event('blur', { bubbles: true })
                                        ].forEach((ev, i) => setTimeout(() => inputElement.dispatchEvent(ev), i * 20));
                                    }
                                }

                                // 最终确认
                                setTimeout(() => {
                                    if ('value' in inputElement && inputElement.value !== finalPrompt) {
                                        inputElement.value = finalPrompt;
                                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
                                }, 300);
                            }, 500);
                        }
                    }

                    D.userQuestionTextarea.value = '';
                    D.contentPanel.classList.add('hidden');
                } else {
                    alert(translations[currentLang].alertSubmitError);
                }
            });
            loadPrompts();
        }

        function getCurrentSiteConfig() {
            const hostname = window.location.hostname;
            for (const key in siteConfigs) {
                if (hostname.includes(key)) return siteConfigs[key];
            }
            return null;
        }

        if (getCurrentSiteConfig()) {
            init();
        }

    });
})();
