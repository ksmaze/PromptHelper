// ==UserScript==
// @name         PromptHelper
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  PromptHelper：通用于 ChatGPT, Gemini, Claude, Kimi, DeepSeek, 通义、元宝、Google AI Studio、Grok 的侧边模板助手（仅保留默认“通用交互式提问模板”，默认选中；更稳事件触发；支持横向按钮与可调高度等基础设置）。
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
// @match        http://grok.com/*
// @match        https://grok.com/*
// @match        http://www.grok.com/*
// @match        https://www.grok.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/545456/PromptHelper.user.js
// @updateURL    https://update.greasyfork.org/scripts/545456/PromptHelper.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const SETTINGS = { forceOpenShadow: true };
    const UI_STORE_KEY = 'universal_prompt_helper_ui_settings';
    const DEFAULT_UI = {
        top: 100,         // 容器距离顶部（px）
        toggleWidth: 120, // Helper 按钮宽度（横向按钮）
        toggleHeight: 40  // Helper 按钮高度（可调，解决遮挡）
    };

    function loadUISettings(){
        try{
            const saved = GM_getValue(UI_STORE_KEY, null);
            const parsed = saved ? JSON.parse(saved) : {};
            return { ...DEFAULT_UI, ...(parsed || {}) };
        }catch{ return { ...DEFAULT_UI }; }
    }
    function saveUISettings(s){ GM_setValue(UI_STORE_KEY, JSON.stringify(s)); }

    // 强制 open shadow（保持原逻辑）
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(options) {
        if (SETTINGS.forceOpenShadow && options && options.mode === 'closed') options.mode = 'open';
        return originalAttachShadow.call(this, options);
    };

    function tryCreateInputEvent(type, opts = {}) { try { return new InputEvent(type, opts); } catch (_) { return new Event(type, { bubbles: !!opts.bubbles, cancelable: !!opts.cancelable }); } }
    function tryCreateKeyboardEvent(type, opts = {}) { try { return new KeyboardEvent(type, opts); } catch (_) { return new Event(type, { bubbles: !!opts.bubbles, cancelable: !!opts.cancelable }); } }

    function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function textToHtmlPreserveBlankLines(text){const lines=text.split('\n');const paras=[];let buf=[];const flush=()=>{if(!buf.length)return;const inner=buf.map(ln=>escapeHtml(ln)).join('<br>');paras.push(`<p>${inner}</p>`);buf=[];};for(let i=0;i<lines.length;i++){const ln=lines[i];if(ln===''){flush();paras.push('<p>&nbsp;</p>');}else buf.push(ln);}flush();if(paras.length===0)paras.push('<p>&nbsp;</p>');return paras.join('');}
    function pasteIntoProseMirror(editableEl, plainText){const html=textToHtmlPreserveBlankLines(plainText);editableEl.focus();let ok=false;try{const dt=new DataTransfer();dt.setData('text/plain',plainText);dt.setData('text/html',html);const evt=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt});ok=editableEl.dispatchEvent(evt);}catch(_){ok=false;}if(!ok){try{document.execCommand('insertText',false,plainText);}catch(_){editableEl.textContent='';editableEl.dispatchEvent(new Event('input',{bubbles:true}));editableEl.textContent=plainText;editableEl.dispatchEvent(new Event('input',{bubbles:true}));}}}

    const nativeTextareaValueSetter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
    const nativeInputValueSetter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    function setNativeValue(el,value){const setter=el.tagName==='TEXTAREA'?nativeTextareaValueSetter:el.tagName==='INPUT'?nativeInputValueSetter:null; if(setter) setter.call(el,value); else el.value=value;}

    window.addEventListener('DOMContentLoaded', () => {

        const siteConfigs = {
            'openai.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea' },
            'chatgpt.com': { name: 'ChatGPT', inputSelector: '#prompt-textarea' },
            'gemini.google.com': { name: 'Gemini', shadowRootSelector: 'chat-app', inputSelector: 'div.initial-input-area textarea, rich-textarea .ql-editor, [contenteditable="true"][role="textbox"]' },
            'claude.ai': { name: 'Claude', inputSelector: '.ProseMirror[contenteditable="true"]' },
            'fuclaude.com': { name: 'Claude', inputSelector: '.ProseMirror[contenteditable="true"]' },
            'kimi.com': { name: 'Kimi', inputSelector: 'div.chat-input-editor[data-lexical-editor="true"], div[contenteditable="true"], textarea, [role="textbox"], [data-lexical-editor]' },
            'kimi.moonshot.cn': { name: 'Kimi', inputSelector: 'div.chat-input-editor[data-lexical-editor="true"], div[contenteditable="true"], textarea, [role="textbox"], [data-lexical-editor]' },
            'deepseek.com': { name: 'DeepSeek', inputSelector: 'textarea[placeholder*="随便聊点什么"], textarea[placeholder*="Ask me anything"], div[contenteditable="true"], #chat-input, [role="textbox"]' },
            'tongyi.com': { name: '通义', inputSelector: 'textarea[placeholder*="有问题，随时问通义"], textarea[placeholder*="问题"], textarea, div[contenteditable="true"], [role="textbox"]' },
            'yuanbao.tencent.com': { name: '腾讯元宝', inputSelector: 'textarea[placeholder*="输入问题"], textarea[placeholder*="问题"], textarea, div[contenteditable="true"], [role="textbox"]' },
            'aistudio.google.com': { name: 'Google AI Studio', shadowRootSelector: 'app-root', inputSelector: '[contenteditable="true"], textarea, [role="textbox"], [aria-label*="prompt"], [aria-label*="Prompt"], [placeholder*="prompt"], [placeholder*="Prompt"], .prompt-input, #prompt-input, input[type="text"]' },
            'grok.com': { name: 'Grok', inputSelector: 'form .query-bar textarea[aria-label], textarea[aria-label*="Grok"], textarea[aria-label*="向 Grok"], textarea' }
        };

        const DEFAULT_TEMPLATE_ID='default_interactive';
        const defaultPrompts={
            [DEFAULT_TEMPLATE_ID]:{
                name:"通用交互式提问模板",
                template:`SYSTEM ROLE — "Audit-Grade Researcher"

You are a meticulous research analyst. You MUST perform genuine web research (“Search (Web Browsing)” or “Deep research” when available; via API use tool/function-calling to invoke web_search or equivalent), filter out uncertain/incorrect/irrelevant claims, and produce an audit-friendly, citation-backed reasoning chain.
Do NOT reveal chain-of-thought or internal notes. Output language: Chinese only.

INTERNAL DEEP THOUGHT (PRIVATE, NEVER PRINT):
- T0 (before Gate 1) and T1 (before Gate 3): silently run a Deep Thought Monologue (first-principles → multi-perspective → recursive self-critique → synergistic synthesis).
- 若仍有不确定或冲突，优先进入澄清而非猜测。

MODEL-SPECIFIC (TOOLS & BEHAVIOR):
- If in Chat: use “Search” for recent/fact-sensitive claims; when complexity is high, escalate to “Deep research” for multi-step, cited synthesis.
- If using the API: invoke web_search (tool/function) for retrieval; when available, enforce the 9-section output with Structured Outputs (JSON Schema).
- If browsing/tools are unavailable, STOP and ask to enable them before proceeding. Do not produce conclusions without web access for source-required tasks.

GATED WORKFLOW (Chinese output; do not proceed to conclusions unless Gate 1 passes):
Gate 1 — Clarify First (pre-research):
  识别问题是否含混/信息缺失/矛盾/错误前提。若存在问题，仅输出澄清块：
    • 问题诊断（≤120字）
    • 需要补充的关键信息（2–5条，多选/示例）
    • 可选默认假设（A/B/C…；声明“未确认不进入研究与结论”）
Gate 2 — Mid-Research Check:
  研究中若发现定义/口径/时段/法域冲突或证据矛盾，暂停并回到澄清模式。
Gate 3 — Pre-Final Check:
  结论前核验：所有用作推理前提的断言均有 [S#]；计算逐步复核；若仍有缺口，回澄清。

METHOD（仅在 Gate 1 通过后执行）：
A) 检索计划：给出你“实际执行”的检索式（引号、逻辑运算、site:/filetype:/date 限制）与动机。
B) 执行检索：打开并对比权威来源；剔除过时/仅观点/不可核验内容；必要时进一步检索补证。
C) 来源与证据表：ID | Title | URL | Publisher | Pub/Update Date | Key Evidence Used | Reliability(High/Med)。
D) 去伪存真记录：列明删除项与理由（过时、观点化、被反证、无法核验、无关）。
E) 已确认事实：仅留可交叉验证事实；关键结论力求 ≥3 个独立来源；每条附 [S#]。
F) 逻辑论证链：编号逐步推导，关键步骤附 [S#]。
G) 结论：中文作答，给出最优答案与置信度/不确定性范围。
H) 局限与更新触发条件：说明残余不确定性与可能改变结论的新证据。

NUMERICAL RIGOR:
- 展示算式与单位换算的逐步过程；逐位检查关键数字；避免心算跳步。

STYLE:
- 中文输出、措辞凝练；每个依赖联网的断言配 [S#] 内联引用；对明显可疑前提先发问再继续（如“为何 1+1 ≠ 2”需界定数学系统/语义上下文）。

FINAL OUTPUT FORMAT（九段固定）：
1) 问题重述（若处于 Clarification Mode，仅输出“问题诊断/信息缺口/可选默认假设”）
2) 检索计划（含实际检索式与时间范围）
3) 来源与证据表（Sources Table）
4) 去伪存真记录（Exclusion Log）
5) 已确认事实清单（全部带 [S#]）
6) 逻辑论证链（逐步推导，步步有 [S#]）
7) 结论（最准确答案 + 置信度/范围）
8) 局限与更新触发条件
9) 参考文献（按 [S#] 列完整引文，含链接与访问日期）

USER QUESTION (paste multi-paragraph content between the markers):
<<<BEGIN_USER_QUESTION>>>
{User Question}
<<<END_USER_QUESTION>>>
`
            }
        };

        // 语言 + 新增设置的多语言
        const translations={
            zh:{
                toggleButton:"Helper",panelTitle:"PromptHelper",collapseTitle:"收起",
                selectTemplate:"选择模板",newBtn:"新建", saveBtn:"保存",deleteBtn:"删除",
                templateName:"模板名称",templateNamePlaceholder:"为您的模板命名",
                templateContent:"模板内容 (使用 {User Question} 作为占位符)",
                yourQuestion:"您的问题", yourQuestionPlaceholder:"在此输入您的具体问题...",
                copyBtn:"复制到剪贴板",copiedBtn:"已复制！", submitBtn:"填入提问栏",
                selectDefault:"-- 选择一个模板 --",
                alertSaveSuccess:"模板已保存！", alertSaveError:"模板名称和内容不能为空！",
                alertDeleteConfirm:"确定要删除模板", alertDeleteError:"请先选择一个要删除的模板！",
                alertCopyError:"复制失败，请查看控制台。", alertSubmitError:"未找到当前网站的输入框。",
                alertTemplateError:"请先选择或创建一个模板！", alertCannotDeleteDefault:"默认模板不可删除。",
                // 新增：设置
                settingsTitle:"基础设置",
                settingTop:"容器顶部偏移（px）",
                settingToggleWidth:"Helper 按钮宽度（px）",
                settingToggleHeight:"Helper 按钮高度（px）",
                settingsSave:"保存设置", settingsReset:"恢复默认"
            },
            en:{
                toggleButton:"Helper",panelTitle:"PromptHelper",collapseTitle:"Collapse",
                selectTemplate:"Select Template",newBtn:"New", saveBtn:"Save",deleteBtn:"Delete",
                templateName:"Template Name",templateNamePlaceholder:"Name your template",
                templateContent:"Template Content (use {User Question} as placeholder)",
                yourQuestion:"Your Question", yourQuestionPlaceholder:"Enter your specific question here...",
                copyBtn:"Copy to Clipboard",copiedBtn:"Copied!", submitBtn:"Fill into Input",
                selectDefault:"-- Select a template --",
                alertSaveSuccess:"Template saved!", alertSaveError:"Template name and content cannot be empty!",
                alertDeleteConfirm:"Are you sure you want to delete the template", alertDeleteError:"Please select a template to delete first!",
                alertCopyError:"Failed to copy. See console for details.", alertSubmitError:"Could not find the input box for the current site.",
                alertTemplateError:"Please select or create a template first!", alertCannotDeleteDefault:"The default template cannot be deleted.",
                // settings
                settingsTitle:"Basic Settings",
                settingTop:"Container top offset (px)",
                settingToggleWidth:"Helper button width (px)",
                settingToggleHeight:"Helper button height (px)",
                settingsSave:"Save Settings", settingsReset:"Reset Defaults"
            }
        };

        let currentLang=GM_getValue('universal_prompt_helper_lang','zh');
        let uiSettings = loadUISettings();

        function injectStyles(){
            GM_addStyle(`
                #prompt-helper-container { all: initial !important; }
                #prompt-helper-container *, #prompt-helper-container *::before, #prompt-helper-container *::after {
                    all: unset !important; box-sizing: border-box !important;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                    margin: 0 !important; padding: 0 !important; text-decoration: none !important; border: none !important; outline: none !important;
                }
                /* 使用 CSS 变量，让UI设置可控 */
                #prompt-helper-container {
                    position: fixed !important;
                    top: var(--ph-top, 100px) !important;
                    right: 0 !important;
                    z-index: 99999 !important;
                    font-size: 16px !important;
                    color: #333 !important;
                    line-height: 1.5 !important;
                }
                /* 横向按钮（去掉 writing-mode） */
                #prompt-helper-toggle {
                    width: var(--ph-toggle-width, 120px) !important;
                    height: var(--ph-toggle-height, 40px) !important;
                    background-color: #007bff !important; color: white !important;
                    border: none !important; border-radius: 10px 0 0 10px !important;
                    cursor: pointer !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    font-size: 16px !important; box-shadow: -2px 2px 5px rgba(0,0,0,0.2) !important;
                    white-space: nowrap !important; padding: 0 12px !important;
                }
                #prompt-helper-content {
                    position: absolute !important;
                    top: 0 !important;
                    right: var(--ph-toggle-width, 120px) !important; /* 跟随按钮宽度 */
                    width: 400px !important;
                    background-color: #f8f9fa !important;
                    border: 1px solid #dee2e6 !important;
                    border-radius: 8px !important;
                    box-shadow: -2px 2px 10px rgba(0,0,0,0.1) !important;
                    padding: 15px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 15px !important;
                    transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out !important;
                    color: #333 !important;
                    text-align: left !important;

                    /* 根据顶部偏移动态计算内部可视高度 */
                    max-height: calc(100vh - var(--ph-top, 100px) - 40px) !important;
                    overflow-y: auto !important;
                    overscroll-behavior: contain !important;
                    -webkit-overflow-scrolling: touch !important;
                    padding-bottom: 20px !important;
                }
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
                #prompt-helper-container button:focus-visible, #prompt-helper-container select:focus-visible, #prompt-helper-container input:focus-visible, #prompt-helper-container textarea:focus-visible { outline: 2px solid #0056b3 !important; outline-offset: 2px !important; }
                #prompt-helper-container .ph-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 10px !important; padding: 0 !important; }
                #prompt-helper-container #ph-collapse-btn { font-size: 24px !important; cursor: pointer !important; color: #6c757d !important; border: none !important; background: none !important; padding: 0 5px !important; line-height: 1 !important; }
                #prompt-helper-container #ph-lang-toggle { font-size: 12px !important; color: #007bff !important; background: none !important; border: 1px solid #007bff !important; padding: 2px 6px !important; border-radius: 4px !important; cursor: pointer !important; }

                /* 设置区的两列布局（小屏自动换行） */
                #prompt-helper-content .ph-grid {
                    display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px 10px !important;
                }
                @media (max-width: 480px) {
                    #prompt-helper-content .ph-grid { grid-template-columns: 1fr !important; }
                }
            `);
        }

        function applyUISettings(container){
            if(!container) return;
            container.style.setProperty('--ph-top', `${uiSettings.top}px`);
            container.style.setProperty('--ph-toggle-width', `${uiSettings.toggleWidth}px`);
            container.style.setProperty('--ph-toggle-height', `${uiSettings.toggleHeight}px`);
        }

        function buildUI(){
            const create=(tag,id,classes=[],attributes={},children=[])=>{
                const el=document.createElement(tag);
                if(id)el.id=id; if(classes.length)el.classList.add(...classes);
                for(const k in attributes)el.setAttribute(k,attributes[k]);
                for(const c of children)el.appendChild(c);
                return el;
            };
            const D={};
            const container=create('div','prompt-helper-container');

            D.toggleButton=create('button','prompt-helper-toggle');
            D.contentPanel=create('div','prompt-helper-content',['hidden']);
            D.langToggleButton=create('button','ph-lang-toggle',[],{},[document.createTextNode('中/En')]);
            D.title=create('h3','ph-title');
            D.collapseButton=create('button','ph-collapse-btn');

            const header=create('div','ph-header',['ph-header'],{},[D.langToggleButton,D.title,D.collapseButton]);

            // 模板选择区
            D.labelSelect=create('label','ph-label-select',[],{for:'ph-template-select'});
            D.templateSelect=create('select','ph-template-select');
            D.newBtn=create('button','ph-new-btn',['ph-btn-primary']);
            D.saveBtn=create('button','ph-save-btn',['ph-btn-success']);
            D.deleteBtn=create('button','ph-delete-btn',['ph-btn-danger']);
            const section1=create('div',null,['ph-section'],{},[
                D.labelSelect,D.templateSelect,
                create('div',null,['ph-button-group'],{},[D.newBtn,D.saveBtn,D.deleteBtn])
            ]);

            // 模板编辑区
            D.labelName=create('label','ph-label-name',[],{for:'ph-template-name'});
            D.templateNameInput=create('input','ph-template-name',[],{type:'text'});
            D.labelContent=create('label','ph-label-content',[],{for:'ph-template-body'});
            D.templateBodyTextarea=create('textarea','ph-template-body');
            const section2=create('div',null,['ph-section'],{},[
                D.labelName,D.templateNameInput,D.labelContent,D.templateBodyTextarea
            ]);

            // 用户问题区
            D.labelQuestion=create('label','ph-label-question',[],{for:'ph-user-question'});
            D.userQuestionTextarea=create('textarea','ph-user-question');
            const section3=create('div',null,['ph-section'],{},[
                D.labelQuestion,D.userQuestionTextarea
            ]);

            // 复制/填入按钮
            D.copyBtn=create('button','ph-copy-btn',['ph-btn-secondary']);
            D.submitBtn=create('button','ph-submit-btn',['ph-btn-primary']);
            const section4=create('div',null,['ph-section'],{},[
                create('div',null,['ph-button-group'],{},[D.copyBtn,D.submitBtn])
            ]);

            // 新增：基础设置区
            D.settingsTitleEl = create('h4','ph-settings-title',[],{},[document.createTextNode('')]);

            D.settingTopLabel = create('label','ph-setting-top-label',[],{for:'ph-setting-top'});
            D.settingTopInput = create('input','ph-setting-top',[],{type:'number', min:'0', step:'1'});

            D.settingToggleWidthLabel = create('label','ph-setting-toggle-width-label',[],{for:'ph-setting-toggle-width'});
            D.settingToggleWidthInput = create('input','ph-setting-toggle-width',[],{type:'number', min:'40', step:'1'});

            D.settingToggleHeightLabel = create('label','ph-setting-toggle-height-label',[],{for:'ph-setting-toggle-height'});
            D.settingToggleHeightInput = create('input','ph-setting-toggle-height',[],{type:'number', min:'24', step:'1'});

            D.settingsSaveBtn = create('button','ph-settings-save',['ph-btn-success']);
            D.settingsResetBtn = create('button','ph-settings-reset',['ph-btn-secondary']);

            const settingsGrid = create('div','ph-settings-grid',['ph-grid'],{},[
                D.settingTopLabel, D.settingTopInput,
                D.settingToggleWidthLabel, D.settingToggleWidthInput,
                D.settingToggleHeightLabel, D.settingToggleHeightInput
            ]);
            const settingsButtons = create('div',null,['ph-button-group'],{},[D.settingsSaveBtn, D.settingsResetBtn]);

            const sectionSettings = create('div',null,['ph-section'],{},[
                D.settingsTitleEl, settingsGrid, settingsButtons
            ]);

            D.contentPanel.append(header,section1,section2,section3,section4,sectionSettings);
            container.append(D.toggleButton,D.contentPanel);
            return {container,elements:D};
        }

        function findInputElement(){ /* 与原逻辑一致，略 */ 
            const siteConfig=getCurrentSiteConfig(); if(!siteConfig){console.log('[PromptHelper] 未找到当前网站配置'); return null;}
            console.log(`[PromptHelper] 正在查找 ${window.location.hostname} 的输入元素...`);
            console.log(`[PromptHelper] 使用选择器: ${siteConfig.inputSelector}`);
            let inputElement=null;
            if(siteConfig.shadowRootSelector){
                const host=document.querySelector(siteConfig.shadowRootSelector);
                if(host&&host.shadowRoot){
                    const elementInShadow=host.shadowRoot.querySelector(siteConfig.inputSelector);
                    if(elementInShadow) inputElement=elementInShadow;
                }
            }
            if(!inputElement){
                const selectors=siteConfig.inputSelector.split(',').map(s=>s.trim());
                for(const selector of selectors){
                    const elements=document.querySelectorAll(selector);
                    for(const element of elements){
                        if(!element.closest('#prompt-helper-container')){ inputElement=element; break; }
                    }
                    if(inputElement) break;
                }
            }
            if(!inputElement&&window.location.hostname.includes('aistudio.google.com')){
                const aiStudioSelectors=['[contenteditable="true"]','textarea','[role="textbox"]','[aria-label*="prompt"]','[aria-label*="Prompt"]','[aria-label*="message"]','[aria-label*="Message"]','[placeholder*="prompt"]','[placeholder*="Prompt"]','[placeholder*="message"]','[placeholder*="Message"]','[data-testid*="prompt"]','[data-testid*="input"]','.prompt-input','.chat-input','.message-input','input[type="text"]','div[spellcheck="true"]','[data-lexical-editor]','.editor-input'];
                for(const selector of aiStudioSelectors){
                    const elements=document.querySelectorAll(selector);
                    for(const element of elements){
                        if(!element.closest('#prompt-helper-container')){
                            const style=window.getComputedStyle(element);
                            const isVisible=style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
                            const isEditable=!element.disabled&&!element.readOnly&&(element.contentEditable==='true'||element.tagName.toLowerCase()==='textarea'||element.tagName.toLowerCase()==='input');
                            if(isVisible&&isEditable){ inputElement=element; break; }
                        }
                    }
                    if(inputElement) break;
                }
            }
            if(!inputElement&&window.location.hostname.includes('deepseek.com')){
                const fallbackSelectors=['textarea','[contenteditable="true"]','[role="textbox"]','input[type="text"]','.chat-input','[data-placeholder]','[aria-label*="输入"]','[aria-label*="input"]','[placeholder*="聊"]','[placeholder*="chat"]'];
                for(const selector of fallbackSelectors){
                    const elements=document.querySelectorAll(selector);
                    for(const element of elements){
                        if(!element.closest('#prompt-helper-container')){
                            const style=window.getComputedStyle(element);
                            if(style.display!=='none'&&style.visibility!=='hidden'&&!element.disabled&&!element.readOnly){ inputElement=element; break; }
                        }
                    }
                    if(inputElement) break;
                }
            }
            if(!inputElement&&window.location.hostname.includes('grok.com')){
                const grokSelectors=['form .query-bar textarea[aria-label]','textarea[aria-label*="Grok"]','textarea[aria-label*="向 Grok"]','textarea'];
                for(const selector of grokSelectors){
                    const elements=document.querySelectorAll(selector);
                    for(const el of elements){
                        if(!el.closest('#prompt-helper-container')){
                            const st=window.getComputedStyle(el);
                            const visible=st.display!=='none'&&st.visibility!=='hidden'&&st.opacity!=='0';
                            const editable=!el.disabled&&!el.readOnly;
                            if(visible&&editable){ inputElement=el; break; }
                        }
                    }
                    if(inputElement) break;
                }
            }
            if(inputElement){
                console.log('[PromptHelper] 成功找到输入元素:',{ tagName:inputElement.tagName,className:inputElement.className,id:inputElement.id,placeholder:inputElement.placeholder,contentEditable:inputElement.contentEditable,element:inputElement});
            } else {
                console.log('[PromptHelper] 未找到输入元素');
                const allInputs=document.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]');
                allInputs.forEach((el,index)=>{ console.log(`[PromptHelper] 候选元素 ${index+1}:`,{ tagName:el.tagName,className:el.className,id:el.id,placeholder:el.placeholder,contentEditable:el.contentEditable,isVisible:window.getComputedStyle(el).display!=='none',element:el}); });
            }
            return inputElement;
        }

        function init(){
            if(document.getElementById('prompt-helper-container')) return;
            if(window.promptHelperInitialized) return;
            window.promptHelperInitialized=true;

            injectStyles();

            const {container,elements:D}=buildUI();

            const addToDOM=()=>{ if(document.body){ document.body.appendChild(container); applyUISettings(container);} else { setTimeout(addToDOM,100);} };
            addToDOM();

            let prompts={};

            const populateDropdown=()=>{ const currentSelection=D.templateSelect.value; D.templateSelect.textContent=''; const defaultOption=document.createElement('option'); defaultOption.value=''; defaultOption.textContent=translations[currentLang].selectDefault; D.templateSelect.appendChild(defaultOption); if(prompts[DEFAULT_TEMPLATE_ID]){ const opt=document.createElement('option'); opt.value=DEFAULT_TEMPLATE_ID; opt.textContent=prompts[DEFAULT_TEMPLATE_ID].name; D.templateSelect.appendChild(opt); } for(const id in prompts){ if(id===DEFAULT_TEMPLATE_ID) continue; const option=document.createElement('option'); option.value=id; option.textContent=prompts[id].name; D.templateSelect.appendChild(option); } if(prompts[currentSelection]) D.templateSelect.value=currentSelection; };

            const displaySelectedPrompt=()=>{ const selectedId=D.templateSelect.value; if(selectedId&&prompts[selectedId]){ D.templateNameInput.value=prompts[selectedId].name; D.templateBodyTextarea.value=prompts[selectedId].template; } else { D.templateNameInput.value=''; D.templateBodyTextarea.value=''; } D.deleteBtn.disabled=(selectedId===DEFAULT_TEMPLATE_ID); };

            const savePrompts=()=>GM_setValue('universal_prompt_helper_prompts',JSON.stringify(prompts));

            function removeLegacyDefaults(obj){ const legacyIds=['prompt_1','prompt_2','prompt_3']; const legacyNames=new Set(['通用回答模板','代码评审模板','英文润色模板']); legacyIds.forEach(id=>{ if(id in obj) delete obj[id]; }); for(const k of Object.keys(obj)){ if(legacyNames.has(obj[k]?.name)) delete obj[k]; } }

            const updateUI=()=>{
                const t=translations[currentLang];
                // 标题与按钮
                D.toggleButton.textContent=t.toggleButton; D.title.textContent=t.panelTitle;
                D.collapseButton.title=t.collapseTitle; D.collapseButton.textContent='\u00d7';
                // 模板区
                D.labelSelect.textContent=t.selectTemplate; D.newBtn.textContent=t.newBtn;
                D.saveBtn.textContent=t.saveBtn; D.deleteBtn.textContent=t.deleteBtn;
                D.labelName.textContent=t.templateName; D.templateNameInput.placeholder=t.templateNamePlaceholder;
                D.labelContent.textContent=t.templateContent; D.labelQuestion.textContent=t.yourQuestion;
                D.userQuestionTextarea.placeholder=t.yourQuestionPlaceholder;
                D.copyBtn.textContent=t.copyBtn; D.submitBtn.textContent=t.submitBtn;

                // 设置区标签与按钮
                D.settingsTitleEl.textContent = t.settingsTitle;
                D.settingTopLabel.textContent = t.settingTop;
                D.settingToggleWidthLabel.textContent = t.settingToggleWidth;
                D.settingToggleHeightLabel.textContent = t.settingToggleHeight;
                D.settingsSaveBtn.textContent = t.settingsSave;
                D.settingsResetBtn.textContent = t.settingsReset;

                // 设置区数值填充
                D.settingTopInput.value = uiSettings.top;
                D.settingToggleWidthInput.value = uiSettings.toggleWidth;
                D.settingToggleHeightInput.value = uiSettings.toggleHeight;

                // 下拉
                populateDropdown();
                if(prompts[DEFAULT_TEMPLATE_ID]) D.templateSelect.value=DEFAULT_TEMPLATE_ID;
                displaySelectedPrompt();
            };

            const generateFinalPrompt=()=>{ const template=D.templateBodyTextarea.value; const question=D.userQuestionTextarea.value; if(!template){ alert(translations[currentLang].alertTemplateError); return null;} return template.replace('{User Question}',question); };

            const loadPrompts=()=>{ const saved=GM_getValue('universal_prompt_helper_prompts',null); if(saved){ try{ prompts=JSON.parse(saved)||{}; }catch{ prompts={}; } removeLegacyDefaults(prompts); if(!prompts[DEFAULT_TEMPLATE_ID]){ prompts[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID]; } savePrompts(); } else { prompts={...defaultPrompts}; savePrompts(); } updateUI(); if(prompts[DEFAULT_TEMPLATE_ID]){ D.templateSelect.value=DEFAULT_TEMPLATE_ID; displaySelectedPrompt(); } };

            // 交互绑定
            D.toggleButton.addEventListener('click',()=>D.contentPanel.classList.remove('hidden'));
            D.collapseButton.addEventListener('click',()=>D.contentPanel.classList.add('hidden'));
            D.langToggleButton.addEventListener('click',()=>{ currentLang=currentLang==='zh'?'en':'zh'; GM_setValue('universal_prompt_helper_lang',currentLang); updateUI(); });
            D.templateSelect.addEventListener('change',displaySelectedPrompt);

            D.newBtn.addEventListener('click',()=>{ D.templateSelect.value=''; D.templateNameInput.value=''; D.templateBodyTextarea.value=''; D.templateNameInput.focus(); D.deleteBtn.disabled=true; });
            D.saveBtn.addEventListener('click',()=>{ const name=D.templateNameInput.value.trim(); const template=D.templateBodyTextarea.value.trim(); if(!name||!template){ alert(translations[currentLang].alertSaveError); return; } let selectedId=D.templateSelect.value||`prompt_${Date.now()}`; prompts[selectedId]={name,template}; savePrompts(); populateDropdown(); D.templateSelect.value=selectedId; displaySelectedPrompt(); alert(`${translations[currentLang].alertSaveSuccess} "${name}"`); });
            D.deleteBtn.addEventListener('click',()=>{ const selectedId=D.templateSelect.value; if(!selectedId){ alert(translations[currentLang].alertDeleteError); return; } if(selectedId===DEFAULT_TEMPLATE_ID){ alert(translations[currentLang].alertCannotDeleteDefault); return; } if(confirm(`${translations[currentLang].alertDeleteConfirm} "${prompts[selectedId].name}"?`)){ delete prompts[selectedId]; savePrompts(); populateDropdown(); if(prompts[DEFAULT_TEMPLATE_ID]) D.templateSelect.value=DEFAULT_TEMPLATE_ID; displaySelectedPrompt(); } });
            D.copyBtn.addEventListener('click',()=>{ const finalPrompt=generateFinalPrompt(); if(finalPrompt){ navigator.clipboard.writeText(finalPrompt).then(()=>{ const originalText=D.copyBtn.textContent; D.copyBtn.textContent=translations[currentLang].copiedBtn; D.copyBtn.disabled=true; setTimeout(()=>{ D.copyBtn.textContent=originalText; D.copyBtn.disabled=false; },2000); }).catch(err=>{ console.error('Copy failed:',err); alert(translations[currentLang].alertCopyError); }); } });

            // 新增：设置保存/重置
            D.settingsSaveBtn.addEventListener('click', ()=>{
                const top = Math.max(0, parseInt(D.settingTopInput.value||DEFAULT_UI.top,10));
                const tw = Math.max(40, parseInt(D.settingToggleWidthInput.value||DEFAULT_UI.toggleWidth,10));
                const th = Math.max(24, parseInt(D.settingToggleHeightInput.value||DEFAULT_UI.toggleHeight,10));
                uiSettings = { top, toggleWidth: tw, toggleHeight: th };
                saveUISettings(uiSettings);
                applyUISettings(document.getElementById('prompt-helper-container'));
            });
            D.settingsResetBtn.addEventListener('click', ()=>{
                uiSettings = { ...DEFAULT_UI };
                saveUISettings(uiSettings);
                D.settingTopInput.value = uiSettings.top;
                D.settingToggleWidthInput.value = uiSettings.toggleWidth;
                D.settingToggleHeightInput.value = uiSettings.toggleHeight;
                applyUISettings(document.getElementById('prompt-helper-container'));
            });

            D.submitBtn.addEventListener('click',()=>{ const finalPrompt=generateFinalPrompt(); if(!finalPrompt) return; const inputElement=findInputElement(); if(!inputElement){ alert(translations[currentLang].alertSubmitError); return; }
                if(inputElement.tagName.toLowerCase()==='textarea'){
                    if(window.location.hostname.includes('tongyi.com')){
                        const reactKey=Object.keys(inputElement).find(key=>key.startsWith('__reactInternalInstance')||key.startsWith('__reactFiber')||key.startsWith('__reactProps')); if(reactKey){ try{ const fiberNode=inputElement[reactKey]; const possiblePaths=[fiberNode?.memoizedProps?.onChange,fiberNode?.return?.memoizedProps?.onChange,fiberNode?.return?.return?.memoizedProps?.onChange,fiberNode?.pendingProps?.onChange]; for(const onChange of possiblePaths){ if(onChange&&typeof onChange==='function'){ const fakeEvent={target:{value:finalPrompt},currentTarget:{value:finalPrompt},preventDefault:()=>{},stopPropagation:()=>{}}; onChange(fakeEvent); break; } } }catch(e){ console.log('[PromptHelper] React状态操作失败:',e);} } inputElement.focus(); inputElement.value=''; inputElement.value=finalPrompt; try{ Object.defineProperty(inputElement,'value',{value:finalPrompt,writable:true,configurable:true}); }catch(_){} [ new Event('focus',{bubbles:true}), tryCreateInputEvent('beforeinput',{bubbles:true,cancelable:true,data:finalPrompt,inputType:'insertText'}), tryCreateInputEvent('input',{bubbles:true,cancelable:true,data:finalPrompt,inputType:'insertText'}), new Event('change',{bubbles:true}), tryCreateKeyboardEvent('keydown',{bubbles:true,key:'a'}), tryCreateKeyboardEvent('keyup',{bubbles:true,key:'a'}), new Event('blur',{bubbles:true}) ].forEach((ev,i)=>setTimeout(()=>inputElement.dispatchEvent(ev),i*10)); setTimeout(()=>{ if(inputElement.value!==finalPrompt) inputElement.value=finalPrompt; inputElement.blur(); setTimeout(()=>{ inputElement.focus(); inputElement.value=finalPrompt; inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:true,data:finalPrompt,inputType:'insertText'})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); inputElement.dispatchEvent(new Event('propertychange',{bubbles:true})); window.dispatchEvent(new Event('resize')); },50); },150);
                    } else if(window.location.hostname.includes('grok.com')){
                        inputElement.focus(); setNativeValue(inputElement,''); inputElement.dispatchEvent(new Event('input',{bubbles:true})); setNativeValue(inputElement,finalPrompt); try{ inputElement.setAttribute('value',finalPrompt);}catch(_){} inputElement.dispatchEvent(tryCreateInputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertFromPaste',data:finalPrompt})); inputElement.dispatchEvent(new Event('input',{bubbles:true})); inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText',data:finalPrompt})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); ['keydown','keypress','keyup'].forEach(type=>inputElement.dispatchEvent(tryCreateKeyboardEvent(type,{bubbles:true,cancelable:true,key:'a',code:'KeyA'}))); try{ inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);}catch(_){} setTimeout(()=>{ inputElement.dispatchEvent(new Event('input',{bubbles:true})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); },50);
                    } else {
                        if(window.location.hostname.includes('openai.com')||window.location.hostname.includes('chatgpt.com')){ inputElement.value=finalPrompt; const isChrome=navigator.userAgent.includes('Chrome')&&!navigator.userAgent.includes('Firefox'); if(isChrome){ setTimeout(()=>{ inputElement.focus(); inputElement.value=finalPrompt; if(typeof inputElement.setSelectionRange==='function') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length); inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:false,inputType:'insertText'})); let protectionCount=0; const protect=()=>{ if(protectionCount<20){ const cur=inputElement.value; if(cur.replace(/\n/g,'')===finalPrompt.replace(/\n/g,'')&&!cur.includes('\n')&&finalPrompt.includes('\n')){ inputElement.value=finalPrompt; if(typeof inputElement.setSelectionRange==='function') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length); inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:false,inputType:'insertText'})); } protectionCount++; setTimeout(protect,100);} }; setTimeout(protect,100); },50);} else { inputElement.dispatchEvent(new Event('input',{bubbles:true})); if(typeof inputElement.setSelectionRange==='function') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length); } } else { inputElement.value=finalPrompt; }
                        if(window.location.hostname.includes('deepseek.com')){ const parentDiv=inputElement.parentElement; if(parentDiv){ let displayDiv=parentDiv.querySelector('.b13855df'); if(!displayDiv){ const allDivs=parentDiv.querySelectorAll('div'); for(const div of allDivs){ if(!div.classList.contains('_24fad49')&&div!==parentDiv){ displayDiv=div; break; } } } if(displayDiv){ displayDiv.innerHTML=''; finalPrompt.split('\n').forEach((line,idx)=>{ if(idx>0) displayDiv.appendChild(document.createElement('br')); displayDiv.appendChild(document.createTextNode(line)); }); } } }
                    }
                } else if(inputElement.getAttribute('contenteditable')==='true'){
                    if(window.location.hostname.includes('claude.ai')||window.location.hostname.includes('fuclaude.com')){ pasteIntoProseMirror(inputElement,finalPrompt); inputElement.dispatchEvent(new Event('input',{bubbles:true})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); try{ const range=document.createRange(); const sel=window.getSelection(); range.selectNodeContents(inputElement); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);}catch(_){} } else { if(window.location.hostname.includes('claude.ai')||window.location.hostname.includes('fuclaude.com')||window.location.hostname.includes('openai.com')||window.location.hostname.includes('chatgpt.com')){ inputElement.innerHTML=''; const lines=finalPrompt.split('\n'); lines.forEach((line,index)=>{ if(index>0) inputElement.appendChild(document.createElement('br')); if(line.length>0) inputElement.appendChild(document.createTextNode(line)); else if(index<lines.length-1) inputElement.appendChild(document.createElement('br')); }); const isChrome=navigator.userAgent.includes('Chrome')&&!navigator.userAgent.includes('Firefox'); if(isChrome){ const needEscape=(window.location.hostname.includes('openai.com')||window.location.hostname.includes('chatgpt.com')); const htmlWithBreaks=needEscape?escapeHtml(finalPrompt).replace(/\n/g,'<br>'):finalPrompt.replace(/\n/g,'<br>'); setTimeout(()=>{ inputElement.focus(); inputElement.innerHTML=htmlWithBreaks; const range=document.createRange(); const sel=window.getSelection(); range.selectNodeContents(inputElement); range.collapse(false); sel.removeAllRanges(); sel.addRange(range); inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:false,inputType:'insertFromPaste'})); let protectionCount=0; const protect=()=>{ if(protectionCount<20){ const currentHtml=inputElement.innerHTML; const currentText=inputElement.textContent||inputElement.innerText; if(currentText.replace(/\n/g,'')===finalPrompt.replace(/\n/g,'')&&!currentHtml.includes('<br>')&&finalPrompt.includes('\n')){ inputElement.innerHTML=htmlWithBreaks; try{ const r=document.createRange(); const s=window.getSelection(); r.selectNodeContents(inputElement); r.collapse(false); s.removeAllRanges(); s.addRange(r);}catch(_){} } protectionCount++; setTimeout(protect,100);} }; setTimeout(protect,100); },50);} } else { inputElement.textContent=finalPrompt; } }
                } else { if('value' in inputElement) inputElement.value=finalPrompt; if(inputElement.textContent!==undefined) inputElement.textContent=finalPrompt; if(inputElement.innerText!==undefined) inputElement.innerText=finalPrompt; }

                ['input','change','keydown','keyup','paste'].forEach(type=>{ let ev; if(type==='input') ev=tryCreateInputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText',data:finalPrompt}); else if(type==='keydown'||type==='keyup') ev=tryCreateKeyboardEvent(type,{bubbles:true,cancelable:true,key:'a',code:'KeyA'}); else ev=new Event(type,{bubbles:true,cancelable:true}); inputElement.dispatchEvent(ev); });

                if(window.location.hostname.includes('deepseek.com')){ ['keydown','keypress','keyup'].forEach(t=>inputElement.dispatchEvent(tryCreateKeyboardEvent(t,{bubbles:true,cancelable:true,key:'a',code:'KeyA',which:65,keyCode:65}))); inputElement.dispatchEvent(new Event('compositionstart',{bubbles:true})); inputElement.dispatchEvent(new Event('compositionupdate',{bubbles:true})); inputElement.dispatchEvent(new Event('compositionend',{bubbles:true})); }

                inputElement.focus(); if(inputElement.tagName.toLowerCase()==='textarea'||inputElement.type==='text'){ try{ inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);}catch(_){}} else if(inputElement.getAttribute('contenteditable')==='true'){ const range=document.createRange(); const sel=window.getSelection(); if(sel&&inputElement.childNodes.length>0){ range.selectNodeContents(inputElement); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);} }

                setTimeout(()=>{ inputElement.dispatchEvent(new Event('input',{bubbles:true})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); const specialSites=['deepseek.com','kimi.moonshot.cn','kimi.com','www.kimi.com','tongyi.com','yuanbao.tencent.com']; const currentSiteCheck=specialSites.find(site=>window.location.hostname.includes(site)); if(currentSiteCheck) console.log(`[PromptHelper] 延迟检查 ${currentSiteCheck} 状态`); },100);

                const specialSites=['deepseek.com','kimi.moonshot.cn','kimi.com','www.kimi.com','tongyi.com','yuanbao.tencent.com','aistudio.google.com']; const currentSite=specialSites.find(site=>window.location.hostname.includes(site)); if(currentSite){ const skipComplexProcessing=(currentSite==='kimi.moonshot.cn'||currentSite==='kimi.com'||currentSite==='www.kimi.com')&&inputElement.getAttribute('contenteditable')==='true'; if(!skipComplexProcessing){ setTimeout(()=>{ const parentDiv=inputElement.parentElement; if(parentDiv){ inputElement.blur(); setTimeout(()=>{ inputElement.focus(); try{ if(inputElement.tagName.toLowerCase()==='textarea'||inputElement.type==='text') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);}catch(_){} },50); window.dispatchEvent(new Event('resize')); const reactKey=Object.keys(inputElement).find(key=>key.startsWith('__reactInternalInstance')||key.startsWith('__reactFiber')); if(reactKey){ try{ const fiberNode=inputElement[reactKey]; if(fiberNode&&fiberNode.memoizedProps&&typeof fiberNode.memoizedProps.onChange==='function'){ const fakeEvent={target:{value:finalPrompt},currentTarget:{value:finalPrompt},preventDefault:()=>{},stopPropagation:()=>{}}; fiberNode.memoizedProps.onChange(fakeEvent); } }catch(e){ console.log(`[PromptHelper] ${currentSite} React状态更新失败:`,e);} } if(currentSite==='tongyi.com'){ inputElement.focus(); inputElement.value=''; const txt=finalPrompt; for(let i=0;i<txt.length;i++){ const ch=txt[i]; inputElement.value+=ch; [ tryCreateKeyboardEvent('keydown',{bubbles:true,cancelable:true,key:ch}), tryCreateInputEvent('input',{bubbles:true,cancelable:true,data:ch,inputType:'insertText'}), tryCreateKeyboardEvent('keyup',{bubbles:true,cancelable:true,key:ch}) ].forEach(ev=>inputElement.dispatchEvent(ev)); } inputElement.dispatchEvent(new Event('change',{bubbles:true})); inputElement.dispatchEvent(new Event('blur',{bubbles:true})); setTimeout(()=>inputElement.focus(),50);
                                } else if(currentSite==='yuanbao.tencent.com'){ try{ inputElement.setAttribute('value',finalPrompt);}catch(_){} }
                                else if(currentSite==='aistudio.google.com'){ const angularKey=Object.keys(inputElement).find(key=>key.startsWith('__ngContext')||key.startsWith('__ng')||key.includes('angular')); if(angularKey){ try{ const ngZone=window.ng?.getComponent?.(inputElement); if(ngZone){ ngZone.run(()=>{ inputElement.value=finalPrompt; if(inputElement.textContent!==undefined) inputElement.textContent=finalPrompt; }); } }catch(e){ console.log('[PromptHelper] Angular状态操作失败:',e);} } if(inputElement.getAttribute('contenteditable')==='true'){ inputElement.innerHTML=''; finalPrompt.split('\n').forEach((line,idx)=>{ if(idx>0) inputElement.appendChild(document.createElement('br')); inputElement.appendChild(document.createTextNode(line)); }); } [ new Event('focus',{bubbles:true}), tryCreateInputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText'}), new Event('change',{bubbles:true}), new Event('blur',{bubbles:true}) ].forEach((ev,i)=>setTimeout(()=>inputElement.dispatchEvent(ev),i*20)); }
                            } setTimeout(()=>{ if('value' in inputElement && inputElement.value!==finalPrompt){ inputElement.value=finalPrompt; inputElement.dispatchEvent(new Event('input',{bubbles:true})); } },300); },500); } }

                D.userQuestionTextarea.value=''; D.contentPanel.classList.add('hidden');
            });

            loadPrompts();
        }

        function getCurrentSiteConfig(){ const hostname=window.location.hostname; for(const key in siteConfigs){ if(hostname.includes(key)) return siteConfigs[key]; } return null; }

        if(getCurrentSiteConfig()){ init(); }
    });
})();
