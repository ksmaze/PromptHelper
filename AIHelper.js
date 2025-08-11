// ==UserScript==
// @name         通用 AI Prompt 助手 (双语版)
// @namespace    http://tampermonkey.net/
// @version      6.1
// @description  一个脚本通用 ChatGPT, Gemini, Claude, Kimi, DeepSeek, 腾讯元宝, Google AI Studio 等多个 AI 平台。提供可收缩的侧边栏，用于管理 Prompt 模板，并能一键复制或提交。
// @author       Sauterne
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://gemini.google.com/*
// @match        https://claude.ai/*
// @match        https://demo.fuclaude.com/*
// @match        https://kimi.moonshot.cn/*
// @match        https://chat.deepseek.com/*
// @match        https://www.tongyi.com/*
// @match        https://yuanbao.tencent.com/chat/*
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
    // @run-at document-start 确保此代码在页面任何脚本执行前运行
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(options) {
        if (options && options.mode === 'closed') {
            options.mode = 'open';
        }
        return originalAttachShadow.call(this, options);
    };

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
            'kimi.moonshot.cn': { name: 'Kimi', inputSelector: 'div.chat-input-editor[data-lexical-editor="true"]' },
            'deepseek.com': { 
                name: 'DeepSeek', 
                inputSelector: 'textarea[placeholder*="随便聊点什么"], textarea[placeholder*="Ask me anything"], div[contenteditable="true"], #chat-input, [role="textbox"]'
            },
            'tongyi.com': { name: '通义', inputSelector: 'textarea[placeholder*="有问题，随时问通义"]' },
            'yuanbao.tencent.com': { name: '腾讯元宝', inputSelector: 'textarea[placeholder*="输入问题"]' },
            'aistudio.google.com': {
                name: 'Google AI Studio',
                shadowRootSelector: 'app-root',
                inputSelector: '[contenteditable="true"][aria-label*="Prompt"]'
            }
        };

        // --- 默认的 Prompt 模板 ---
        const defaultPrompts = {
            "prompt_1": { name: "通用回答模板", template: `请基于以下问题，提供一个清晰、结构化且全面的回答。\n\n用户问题：\n{User Question}` },
            "prompt_2": { name: "代码评审模板", template: `我是一名软件工程师，请帮我评审以下代码。我希望你关注代码的可读性、性能、潜在的 bug 和最佳实践。请用中文提供具体的改进建议。\n\n以下是我的代码：\n\`\`\`\n{User Question}\n\`\`\`` },
            "prompt_3": { name: "英文润色模板", template: `Please act as an English polisher. Your task is to refine the following text, improving its grammar, clarity, and style while preserving the original meaning. Please provide the polished version directly without any explanation unless I ask for it.\n\nOriginal text:\n"{User Question}"` }
        };

        // --- 国际化文本 ---
        const translations = {
            zh: {
                toggleButton: "助手", panelTitle: "Prompt 助手", collapseTitle: "收起", selectTemplate: "选择模板", newBtn: "新建",
                saveBtn: "保存", deleteBtn: "删除", templateName: "模板名称", templateNamePlaceholder: "为您的模板命名",
                templateContent: "模板内容 (使用 {User Question} 作为占位符)", yourQuestion: "您的问题",
                yourQuestionPlaceholder: "在此输入您的具体问题...", copyBtn: "复制到剪贴板", copiedBtn: "已复制！",
                submitBtn: "填入提问栏", selectDefault: "-- 选择一个模板 --", alertSaveSuccess: "模板已保存！",
                alertSaveError: "模板名称和内容不能为空！", alertDeleteConfirm: "确定要删除模板",
                alertDeleteError: "请先选择一个要删除的模板！", alertCopyError: "复制失败，请查看控制台。",
                alertSubmitError: "未找到当前网站的输入框。", alertTemplateError: "请先选择或创建一个模板！"
            },
            en: {
                toggleButton: "Helper", panelTitle: "Prompt Helper", collapseTitle: "Collapse", selectTemplate: "Select Template", newBtn: "New",
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
            if (!siteConfig) return null;
            
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
                // 尝试选择器中的每个部分
                const selectors = siteConfig.inputSelector.split(',').map(s => s.trim());
                for (const selector of selectors) {
                    inputElement = document.querySelector(selector);
                    if (inputElement) break;
                }
            }
            
            // 3. 对于 DeepSeek，提供额外的回退查找逻辑
            if (!inputElement && window.location.hostname.includes('deepseek.com')) {
                // 更广泛的查找策略
                const fallbackSelectors = [
                    'textarea',
                    '[contenteditable="true"]',
                    '[role="textbox"]',
                    'input[type="text"]',
                    '.chat-input',
                    '[data-placeholder]',
                    '[aria-label*="输入"]',
                    '[aria-label*="input"]',
                    '[placeholder*="聊"]',
                    '[placeholder*="chat"]'
                ];
                
                for (const selector of fallbackSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        // 检查元素是否可见且可编辑
                        const style = window.getComputedStyle(element);
                        if (style.display !== 'none' && 
                            style.visibility !== 'hidden' && 
                            !element.disabled && 
                            !element.readOnly) {
                            inputElement = element;
                            break;
                        }
                    }
                    if (inputElement) break;
                }
            }
            
            return inputElement;
        }

        function init() {
            if (document.getElementById('prompt-helper-container')) return;
            
            // 防止多次初始化和第三方脚本干扰
            if (window.promptHelperInitialized) return;
            window.promptHelperInitialized = true;
            
            injectStyles();
            const { container, elements: D } = buildUI();
            
            // 使用更安全的方式添加到 DOM
            const addToDOM = () => {
                if (document.body) {
            document.body.appendChild(container);
                } else {
                    // 如果 body 还不存在，等待一下
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
                    // 调试信息：在控制台记录找到的输入元素
                    console.log('[Prompt Helper] 找到输入元素:', {
                        tagName: inputElement.tagName,
                        className: inputElement.className,
                        id: inputElement.id,
                        placeholder: inputElement.placeholder,
                        contentEditable: inputElement.contentEditable,
                        type: inputElement.type,
                        element: inputElement
                    });
                    
                    // 增强的输入处理逻辑，支持多种类型的输入框
                    if (inputElement.tagName.toLowerCase() === 'textarea') {
                        // 标准 textarea 处理
                        inputElement.value = finalPrompt;
                        
                        // 特殊处理：DeepSeek 的 textarea + div 架构
                        if (window.location.hostname.includes('deepseek.com')) {
                            // 查找相邻的显示元素
                            const parentDiv = inputElement.parentElement;
                            if (parentDiv) {
                                // 查找显示内容的 div（基于实际的HTML结构）
                                let displayDiv = parentDiv.querySelector('.b13855df');
                                
                                if (!displayDiv) {
                                    // 回退方案：查找不是容器的div
                                    const allDivs = parentDiv.querySelectorAll('div');
                                    for (const div of allDivs) {
                                        if (!div.classList.contains('_24fad49') && div !== parentDiv) {
                                            displayDiv = div;
                                            break;
                                        }
                                    }
                                }
                                
                                if (displayDiv) {
                                    console.log('[Prompt Helper] 找到DeepSeek显示元素:', displayDiv);
                                    // 清空并设置新内容
                                    displayDiv.innerHTML = '';
                                    const lines = finalPrompt.split('\n');
                                    lines.forEach((line, index) => {
                                        if (index > 0) {
                                            displayDiv.appendChild(document.createElement('br'));
                                        }
                                        displayDiv.appendChild(document.createTextNode(line));
                                    });
                                } else {
                                    console.log('[Prompt Helper] 未找到DeepSeek显示元素，尝试直接设置textarea');
                                }
                            }
                        }
                    } else if (inputElement.getAttribute('contenteditable') === 'true') {
                        // contenteditable 元素处理
                        inputElement.textContent = '';
                        const lines = finalPrompt.split('\n');
                        lines.forEach(line => {
                            const p = document.createElement('p');
                            if (line.trim() === '') {
                                p.appendChild(document.createElement('br'));
                            } else {
                                p.textContent = line;
                            }
                            inputElement.appendChild(p);
                        });
                    } else {
                        // 其他类型的输入元素处理（如特殊的 React 组件）
                        // 尝试多种方法来设置值
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
                    
                    // 触发多种事件以确保输入被识别
                    const events = ['input', 'change', 'keydown', 'keyup', 'paste'];
                    events.forEach(eventType => {
                        const event = new Event(eventType, { bubbles: true, cancelable: true });
                        inputElement.dispatchEvent(event);
                    });
                    
                    // 特殊处理：针对 React 组件的额外事件
                    const inputEvent = new InputEvent('input', { 
                        bubbles: true, 
                        cancelable: true, 
                        data: finalPrompt,
                        inputType: 'insertText'
                    });
                    inputElement.dispatchEvent(inputEvent);
                    
                    // DeepSeek 特殊处理：模拟键盘输入
                    if (window.location.hostname.includes('deepseek.com')) {
                        console.log('[Prompt Helper] 应用DeepSeek特殊处理');
                        
                        // 模拟键盘事件
                        const keyEvents = ['keydown', 'keypress', 'keyup'];
                        keyEvents.forEach(eventType => {
                            const keyEvent = new KeyboardEvent(eventType, {
                                bubbles: true,
                                cancelable: true,
                                key: 'a',
                                code: 'KeyA',
                                which: 65,
                                keyCode: 65
                            });
                            inputElement.dispatchEvent(keyEvent);
                        });
                        
                        // 尝试触发组合事件
                        inputElement.dispatchEvent(new Event('compositionstart', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('compositionupdate', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('compositionend', { bubbles: true }));
                    }
                    
                    // 聚焦和光标定位
                    inputElement.focus();
                    
                    // 尝试设置光标位置
                    if (inputElement.tagName.toLowerCase() === 'textarea' || inputElement.type === 'text') {
                        inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length);
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
                    
                    // 延迟再次触发事件以确保现代框架检测到变化
                    setTimeout(() => {
                        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // DeepSeek 额外处理：仅检查，不重复设置（避免重复）
                        if (window.location.hostname.includes('deepseek.com')) {
                            console.log('[Prompt Helper] 延迟检查DeepSeek状态');
                            const parentDiv = inputElement.parentElement;
                            if (parentDiv) {
                                const displayDiv = parentDiv.querySelector('.b13855df, div:not(._24fad49)');
                                if (displayDiv) {
                                    console.log('[Prompt Helper] DeepSeek显示元素状态检查完成');
                                    // 不再在这里设置内容，避免重复
                                }
                            }
                        }
                    }, 100);
                    
                    // 更长延迟的额外同步检查
                    if (window.location.hostname.includes('deepseek.com')) {
                        setTimeout(() => {
                            const parentDiv = inputElement.parentElement;
                            if (parentDiv) {
                                const displayDiv = parentDiv.querySelector('.b13855df, div:not(._24fad49)');
                                if (displayDiv) {
                                    console.log('[Prompt Helper] 最终强制同步');
                                    displayDiv.textContent = finalPrompt;
                                    
                                    // 额外的视觉刷新方法
                                    console.log('[Prompt Helper] 触发视觉刷新');
                                    
                                    // 方法1：模拟点击来刷新界面
                                    displayDiv.click();
                                    
                                    // 方法2：强制重绘
                                    displayDiv.style.display = 'none';
                                    displayDiv.offsetHeight; // 触发重排
                                    displayDiv.style.display = '';
                                    
                                    // 方法3：模拟焦点变化
                                    inputElement.blur();
                                    setTimeout(() => {
                                        inputElement.focus();
                                        inputElement.setSelectionRange(finalPrompt.length, finalPrompt.length);
                                    }, 50);
                                    
                                    // 方法4：触发resize事件（某些框架监听此事件）
                                    window.dispatchEvent(new Event('resize'));
                                    
                                    // 方法5：完全重新开始的真实输入模拟
                                    console.log('[Prompt Helper] 开始完全重置并模拟真实输入');
                                    
                                    // 完全清理状态
                                    inputElement.value = '';
                                    displayDiv.textContent = '';
                                    displayDiv.innerHTML = '';
                                    
                                    // 确保焦点在正确位置
                                    inputElement.focus();
                                    
                                    // 使用更强的方法：直接设置React内部状态
                                    // 查找React实例
                                    const reactKey = Object.keys(inputElement).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
                                    if (reactKey) {
                                        console.log('[Prompt Helper] 发现React实例，尝试直接更新状态');
                                        try {
                                            const fiberNode = inputElement[reactKey];
                                            if (fiberNode && fiberNode.memoizedProps && fiberNode.memoizedProps.onChange) {
                                                // 创建模拟的React事件
                                                const fakeEvent = {
                                                    target: { value: finalPrompt },
                                                    currentTarget: { value: finalPrompt },
                                                    preventDefault: () => {},
                                                    stopPropagation: () => {}
                                                };
                                                fiberNode.memoizedProps.onChange(fakeEvent);
                                            }
                                        } catch (e) {
                                            console.log('[Prompt Helper] React状态更新失败:', e);
                                        }
                                    }
                                    
                                    // 一次性设置完整内容（移除流式打字效果）
                                    console.log('[Prompt Helper] 一次性设置完整内容');
                                    inputElement.value = finalPrompt;
                                    displayDiv.textContent = finalPrompt;
                                    
                                    // 触发关键事件（简化版本，避免重复）
                                    const events = [
                                        new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: finalPrompt, inputType: 'insertText' }),
                                        new InputEvent('input', { bubbles: true, cancelable: true, data: finalPrompt, inputType: 'insertText' }),
                                        new Event('change', { bubbles: true })
                                    ];
                                    
                                    events.forEach(event => inputElement.dispatchEvent(event));
                                    console.log('[Prompt Helper] 一次性设置完成');
                                    
                                    // 最终确认和清理（移除粘贴方法以避免重复）
                                    setTimeout(() => {
                                        console.log('[Prompt Helper] 最终确认内容正确性');
                                        
                                        // 确保内容一致性，但不重新设置（避免重复）
                                        if (inputElement.value !== finalPrompt || displayDiv.textContent !== finalPrompt) {
                                            console.log('[Prompt Helper] 检测到内容不一致，进行最终同步');
                                            inputElement.value = finalPrompt;
                                            displayDiv.textContent = finalPrompt;
                                            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                                        } else {
                                            console.log('[Prompt Helper] 内容已正确同步');
                                        }
                                        
                                    }, 300); // 缩短延迟时间
                                }
                            }
                        }, 500);
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