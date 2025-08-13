// ==UserScript==
// @name         PromptHelper
// @namespace    http://tampermonkey.net/
// @version      1.7.2
// @description  PromptHelper：通用于 ChatGPT, Gemini, Claude, Kimi, DeepSeek, 通义、元宝、Google AI Studio、Grok、豆包 的侧边模板助手；主/设分离；导入/导出；从聊天栏读取并回填；Kimi/Claude 专项处理（覆盖、不重复、换行保真）。站点默认模板（通配符、早保存优先）；“应用默认模板”一键套用站点默认/全局默认；修复并发覆盖（读-改-写）；Helper 按钮蓝色适配黑底站点；夜间模式可切换并持久化。本版：导入/导出升级为“打包”：模板 + 站点规则 + UI 按钮位置信息，向后兼容旧模板-only 文件，按读改写合并、规则追加、UI 即时应用与持久化，确保不影响现有站点填充逻辑。
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
// @match        http://doubao.com/*
// @match        https://doubao.com/*
// @match        http://www.doubao.com/*
// @match        https://www.doubao.com/*
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
    const PROMPTS_STORE_KEY = 'universal_prompt_helper_prompts';
    const LANG_STORE_KEY = 'universal_prompt_helper_lang';
    const SITE_DEFAULTS_STORE_KEY = 'universal_prompt_helper_site_defaults';
    const THEME_STORE_KEY = 'universal_prompt_helper_theme';
    const DEFAULT_UI = { top: 100, toggleWidth: 120, toggleHeight: 40 };
    const DEFAULT_TEMPLATE_ID = 'default_interactive';
    const EXPORT_SCHEMA_TEMPLATES = 'prompthelper.templates.v1'; // 兼容旧版
    const EXPORT_SCHEMA_BUNDLE = 'prompthelper.bundle.v1';       // 新版打包
    const IMPORT_SUFFIX_BASE = ' (imported)';

    function loadUISettings(){
        try{
            const saved = GM_getValue(UI_STORE_KEY, null);
            const parsed = saved ? JSON.parse(saved) : {};
            return { ...DEFAULT_UI, ...(parsed || {}) };
        }catch{ return { ...DEFAULT_UI }; }
    }
    function saveUISettings(s){ GM_setValue(UI_STORE_KEY, JSON.stringify(s)); }

    function loadSiteDefaults(){
        try{
            const saved = GM_getValue(SITE_DEFAULTS_STORE_KEY, '[]');
            const arr = JSON.parse(saved);
            return Array.isArray(arr) ? arr : [];
        }catch{ return []; }
    }
    function saveSiteDefaults(arr){
        GM_setValue(SITE_DEFAULTS_STORE_KEY, JSON.stringify(Array.isArray(arr)?arr:[]));
    }

    function loadTheme(){
        const t = GM_getValue(THEME_STORE_KEY, 'light');
        return (t==='dark') ? 'dark' : 'light';
    }
    function saveTheme(t){
        GM_setValue(THEME_STORE_KEY, (t==='dark')?'dark':'light');
    }

    // 强制 open shadow
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(options) {
        if (SETTINGS.forceOpenShadow && options && options.mode === 'closed') options.mode = 'open';
        return originalAttachShadow.call(this, options);
    };

    function tryCreateInputEvent(type, opts = {}) { try { return new InputEvent(type, opts); } catch (_) { return new Event(type, { bubbles: !!opts.bubbles, cancelable: !!opts.cancelable }); } }
    function tryCreateKeyboardEvent(type, opts = {}) { try { return new KeyboardEvent(type, opts); } catch (_) { return new Event(type, { bubbles: !!opts.bubbles, cancelable: !!opts.cancelable }); } }

    function escapeHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
    function textToHtmlPreserveBlankLines(text){
        const lines=text.split('\n');const paras=[];let buf=[];
        const flush=()=>{if(!buf.length)return;const inner=buf.map(ln=>escapeHtml(ln)).join('<br>');paras.push(`<p>${inner}</p>`);buf=[];};
        for(let i=0;i<lines.length;i++){const ln=lines[i];if(ln===''){flush();paras.push('<p><br></p>');}else buf.push(ln);}flush();
        if(paras.length===0)paras.push('<p><br></p>');
        return paras.join('');
    }
    function textToProseMirrorParagraphHTML(text){
        const lines = text.split('\n');
        if(lines.length===0) return '<p><br></p>';
        let html = '';
        for(const ln of lines){
            if(ln==='') html += '<p><br></p>';
            else html += `<p>${escapeHtml(ln)}</p>`;
        }
        return html;
    }
    function pasteIntoProseMirror(editableEl, plainText, opts={}){
        const pmStrict = !!opts.pmStrict;
        const html = pmStrict ? textToProseMirrorParagraphHTML(plainText)
                              : textToHtmlPreserveBlankLines(plainText);
        editableEl.focus();
        let ok=false;
        try{
            const dt=new DataTransfer();
            dt.setData('text/plain',plainText);
            dt.setData('text/html',html);
            const evt=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt});
            ok=editableEl.dispatchEvent(evt);
        }catch(_){ok=false;}
        if(!ok){
            try{ document.execCommand('insertHTML', false, html); }
            catch(_){
                editableEl.textContent=''; editableEl.dispatchEvent(new Event('input',{bubbles:true}));
                editableEl.textContent=plainText; editableEl.dispatchEvent(new Event('input',{bubbles:true}));
            }
        }
    }

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
            'grok.com': { name: 'Grok', inputSelector: 'form .query-bar textarea[aria-label], textarea[aria-label*="Grok"], textarea[aria-label*="向 Grok"], textarea' },
            'doubao.com': { name: '豆包', inputSelector: 'textarea[placeholder*="输入"], textarea[placeholder*="问题"], textarea, div[contenteditable="true"], [role="textbox"], [aria-label*="输入"], [aria-label*="提问"], [data-lexical-editor], .ProseMirror' }
        };

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
F) 逻辑论证链：逐步推导，步步有 [S#]。
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

        const translations={
            zh:{
                toggleButton:"Helper",panelTitle:"PromptHelper",collapseTitle:"收起",
                selectTemplate:"选择模板",newBtn:"新建", saveBtn:"保存",deleteBtn:"删除",
                templateName:"模板名称",templateNamePlaceholder:"为您的模板命名",
                templateContent:"模板内容 (使用 {User Question} 作为占位符)",
                copyBtn:"复制到剪贴板",copiedBtn:"已复制！", submitBtn:"应用到聊天栏",
                selectDefault:"-- 选择一个模板 --",
                alertSaveSuccess:"模板已保存！", alertSaveError:"模板名称和内容不能为空！",
                alertDeleteConfirm:"确定要删除模板", alertDeleteError:"请先选择一个要删除的模板！",
                alertCopyError:"复制失败，请查看控制台。", alertSubmitError:"未找到当前网站的输入框。",
                alertTemplateError:"请先选择或创建一个模板！",
                alertCannotDeleteDefault:"默认模板不可删除。",
                alertNoUserInput:"聊天栏为空，请先在聊天栏输入内容再应用模板。",
                settingsTitle:"基础设置",
                settingTop:"容器顶部偏移（px）",
                settingToggleWidth:"Helper 按钮宽度（px）",
                settingToggleHeight:"Helper 按钮高度（px）",
                settingsSave:"保存设置", settingsReset:"恢复默认",
                importBtn:"导入模板", exportBtn:"导出模板",
                alertExportEmpty:"没有可导出的模板（默认模板不导出）。",
                alertExportDone:"模板已导出为文件：",
                alertImportInvalid:"导入失败：文件格式无效或为空。",
                alertImportDone:(added,renamed)=>`成功导入 ${added} 个模板（其中 ${renamed} 个已重命名避免重名）。`,
                quickApplyBtn:"应用默认模板",
                siteDefaultsTitle:"站点默认模板",
                siteDefaultsList:"已保存规则",
                sitePattern:"域名/通配符",
                siteTemplate:"绑定模板",
                siteNewBtn:"新建规则", siteSaveBtn:"保存规则", siteDeleteBtn:"删除规则",
                alertSitePatternRequired:"请输入域名或通配符（如 *.example.com、kimi.* 等）。",
                alertSiteTemplateRequired:"请选择要绑定的模板。",
                alertSiteSelectFirst:"请先选择一条规则。",
                alertSiteSaved:"规则已保存！",
                alertSiteDeleted:"规则已删除！",
                themeToggleLightTitle:"切换夜间模式",
                themeToggleDarkTitle:"切换日间模式"
            },
            en:{
                toggleButton:"Helper",panelTitle:"PromptHelper",collapseTitle:"Collapse",
                selectTemplate:"Select Template",newBtn:"New", saveBtn:"Save",deleteBtn:"Delete",
                templateName:"Template Name",templateNamePlaceholder:"Name your template",
                templateContent:"Template Content (use {User Question} as placeholder)",
                copyBtn:"Copy to Clipboard",copiedBtn:"Copied!", submitBtn:"Apply to Chat Box",
                selectDefault:"-- Select a template --",
                alertSaveSuccess:"Template saved!", alertSaveError:"Template name and content cannot be empty!",
                alertDeleteConfirm:"Are you sure you want to delete the template", alertDeleteError:"Please select a template to delete first!",
                alertCopyError:"Failed to copy. See console for details.", alertSubmitError:"Could not find the input box for the current site.",
                alertTemplateError:"Please select or create a template first!",
                alertCannotDeleteDefault:"The default template cannot be deleted.",
                alertNoUserInput:"Input box is empty. Type your prompt first, then apply the template.",
                settingsTitle:"Basic Settings",
                settingTop:"Container top offset (px)",
                settingToggleWidth:"Helper button width (px)",
                settingToggleHeight:"Helper button height (px)",
                settingsSave:"Save Settings", settingsReset:"Reset Defaults",
                importBtn:"Import", exportBtn:"Export",
                alertExportEmpty:"No templates to export (default is excluded).",
                alertExportDone:"Templates exported as file: ",
                alertImportInvalid:"Import failed: invalid or empty file.",
                alertImportDone:(added,renamed)=>`Imported ${added} templates (${renamed} renamed to avoid conflicts).`,
                quickApplyBtn:"Quick Apply",
                siteDefaultsTitle:"Site Default Templates",
                siteDefaultsList:"Saved Rules",
                sitePattern:"Domain / Wildcard",
                siteTemplate:"Bound Template",
                siteNewBtn:"New Rule", siteSaveBtn:"Save Rule", siteDeleteBtn:"Delete Rule",
                alertSitePatternRequired:"Please enter a domain/wildcard (e.g. *.example.com, kimi.*).",
                alertSiteTemplateRequired:"Please choose a template to bind.",
                alertSiteSelectFirst:"Please select a rule first.",
                alertSiteSaved:"Rule saved!",
                alertSiteDeleted:"Rule deleted!",
                themeToggleLightTitle:"Toggle dark mode",
                themeToggleDarkTitle:"Toggle light mode"
            }
        };

        let currentLang=GM_getValue(LANG_STORE_KEY,'zh');
        let uiSettings = loadUISettings();
        let siteDefaults = loadSiteDefaults();
        let currentTheme = loadTheme(); // 'light' | 'dark'

        function injectStyles(){
            GM_addStyle(`
                #prompt-helper-container { all: initial !important; }
                #prompt-helper-container *, #prompt-helper-container *::before, #prompt-helper-container *::after {
                    all: unset !important; box-sizing: border-box !important;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                    margin: 0 !important; padding: 0 !important; text-decoration: none !important; border: none !important; outline: none !important;
                }
                /* 主题变量（默认：明亮） */
                #prompt-helper-container {
                    --ph-bg: #f8f9fa;
                    --ph-text: #333333;
                    --ph-border: #dee2e6;
                    --ph-input-bg: #ffffff;
                    --ph-input-border: #adb5bd;
                    --ph-header-text: #343a40;
                    --ph-focus: rgba(0,123,255,.25);
                    position: fixed !important;
                    top: var(--ph-top, 100px) !important;
                    right: 0 !important;
                    z-index: 99999 !important;
                    font-size: 16px !important;
                    color: var(--ph-text) !important;
                    line-height: 1.5 !important;
                }
                /* 夜间主题覆盖 */
                #prompt-helper-container[data-theme="dark"] {
                    --ph-bg: #1f2329;
                    --ph-text: #e6e6e6;
                    --ph-border: #3b4048;
                    --ph-input-bg: #2b2f36;
                    --ph-input-border: #4a4f57;
                    --ph-header-text: #e6e6e6;
                    --ph-focus: rgba(0,123,255,.35);
                }

                /* Helper 主按钮：蓝色增强对比 */
                #prompt-helper-toggle {
                    width: var(--ph-toggle-width, 120px) !important;
                    height: var(--ph-toggle-height, 40px) !important;
                    background-color: #007bff !important; color: #fff !important;
                    border-radius: 10px 0 0 10px !important;
                    cursor: pointer !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    font-size: 16px !important; box-shadow: -2px 2px 5px rgba(0,0,0,0.2) !important;
                    white-space: nowrap !important; padding: 0 12px !important;
                }
                /* 快速应用按钮：绿色 */
                #prompt-helper-quickapply {
                    width: var(--ph-toggle-width, 120px) !important;
                    height: 32px !important;
                    margin-top: 6px !important;
                    background-color: #28a745 !important; color: #fff !important;
                    border-radius: 10px 0 0 10px !important;
                    cursor: pointer !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    font-size: 13px !important; box-shadow: -2px 2px 5px rgba(0,0,0,0.18) !important;
                    white-space: nowrap !important; padding: 0 10px !important;
                }
                #prompt-helper-quickapply:hover { filter: brightness(0.95) !important; }

                #prompt-helper-content {
                    position: absolute !important;
                    top: 0 !important;
                    right: var(--ph-toggle-width, 120px) !important;
                    width: 400px !important;
                    background-color: var(--ph-bg) !important;
                    border: 1px solid var(--ph-border) !important;
                    border-radius: 8px !important;
                    box-shadow: -2px 2px 10px rgba(0,0,0,0.1) !important;
                    padding: 14px !important;
                    display: flex !重要;
                    flex-direction: column !important;
                    gap: 10px !important;
                    transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out !important;
                    color: var(--ph-text) !important;
                    text-align: left !important;
                    max-height: calc(100vh - var(--ph-top, 100px) - 40px) !important;
                    overflow-y: auto !important;
                    overscroll-behavior: contain !important;
                    -webkit-overflow-scrolling: touch !important;
                    padding-bottom: 14px !important;
                }
                #prompt-helper-content.hidden { transform: translateX(100%) !important; opacity: 0 !important; pointer-events: none !important; }
                #prompt-helper-content h3 { padding: 0 !important; font-size: 18px !important; color: var(--ph-header-text) !重要; text-align: center !important; font-weight: bold !important; }

                /* 主/设双页互斥 */
                #prompt-helper-content[data-view="main"]    #ph-settings-view { display: none !important; }
                #prompt-helper-content[data-view="settings"] #ph-main-view     { display: none !important; }

                /* 区块与间距（适度紧凑但不重叠） */
                #prompt-helper-content .ph-section { display: flex !important; flex-direction: column !important; gap: 6px !important; }
                #prompt-helper-content .ph-section + .ph-section { margin-top: 8px !important; }

                /* 表单外观（可见边框 + 聚焦高亮） */
                #prompt-helper-content select,
                #prompt-helper-content input,
                #prompt-helper-content textarea {
                    appearance: auto !important;
                    -webkit-appearance: auto !important;
                    -moz-appearance: auto !important;
                    width: 100% !important;
                    padding: 8px !important;
                    border: 1px solid var(--ph-input-border) !important;
                    border-radius: 6px !important;
                    background-color: var(--ph-input-bg) !important;
                    color: var(--ph-text) !important;
                    line-height: 1.5 !important;
                    background-clip: padding-box !important;
                }
                #prompt-helper-content textarea { resize: vertical !important; min-height: 100px !important; }
                #prompt-helper-content #ph-template-body { height: 150px !important; }
                #prompt-helper-content select:focus,
                #prompt-helper-content input:focus,
                #prompt-helper-content textarea:focus {
                    border-color: #80bdff !important;
                    box-shadow: 0 0 0 3px var(--ph-focus) !important;
                    outline: none !important;
                }

                /* 按钮组 */
                #prompt-helper-content .ph-button-group { display: flex !important; gap: 8px !important; justify-content: space-between !important; margin-top: 6px !important; }
                #prompt-helper-content .ph-button-group button { flex-grow: 1 !important; }
                #prompt-helper-content button { padding: 10px !important; border-radius: 5px !important; border: none !important; cursor: pointer !important; font-size: 14px !important; font-weight: bold !important; transition: background-color 0.2s, color 0.2s !important; color: white !important; }
                #prompt-helper-content button:disabled { cursor: not-allowed !important; opacity: 0.7 !important; }

                #prompt-helper-container .ph-btn-primary { background-color: #007bff !important; } #prompt-helper-container .ph-btn-primary:hover { background-color: #0056b3 !important; }
                #prompt-helper-container .ph-btn-secondary { background-color: #6c757d !important; } #prompt-helper-container .ph-btn-secondary:hover { background-color: #5a6268 !important; }
                #prompt-helper-container .ph-btn-success { background-color: #28a745 !important; } #prompt-helper-container .ph-btn-success:hover { background-color: #218838 !important; }
                #prompt-helper-container .ph-btn-danger { background-color: #dc3545 !important; } #prompt-helper-container .ph-btn-danger:hover { background-color: #c82333 !important; }
                #prompt-helper-container button:focus-visible, #prompt-helper-container select:focus-visible, #prompt-helper-container input:focus-visible, #prompt-helper-container textarea:focus-visible { outline: 2px solid #0056b3 !important; outline-offset: 2px !important; }

                /* 头部 */
                #prompt-helper-container .ph-header { display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 6px !important; padding: 0 !important; }
                #prompt-helper-container .ph-header-right { display: flex !important; align-items: center !important; gap: 8px !important; }
                #prompt-helper-container #ph-collapse-btn { font-size: 24px !important; cursor: pointer !important; color: #6c757d !important; background: none !important; padding: 0 5px !important; line-height: 1 !important; }

                /* 语言/设置/主题按钮（随主题变色） */
                #prompt-helper-container #ph-lang-toggle,
                #prompt-helper-container #ph-settings-btn,
                #prompt-helper-container #ph-theme-btn {
                    font-size: 12px !important;
                    color: var(--ph-text) !important;
                    background: var(--ph-input-bg) !important;
                    border: 1px solid var(--ph-input-border) !important;
                    padding: 2px 8px !important;
                    border-radius: 4px !important;
                    cursor: pointer !important;
                }
                #prompt-helper-container #ph-lang-toggle:hover,
                #prompt-helper-container #ph-settings-btn:hover,
                #prompt-helper-container #ph-theme-btn:hover {
                    background: rgba(0,0,0,0.06) !important;
                }
                #prompt-helper-container[data-theme="dark"] #ph-lang-toggle:hover,
                #prompt-helper-container[data-theme="dark"] #ph-settings-btn:hover,
                #prompt-helper-container[data-theme="dark"] #ph-theme-btn:hover {
                    background: #353b43 !important;
                }

                /* 设置页 */
                #prompt-helper-container #ph-settings-view { display: flex !important; flex-direction: column !important; gap: 10px !important; }
                #prompt-helper-content .ph-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px 10px !important; }
                @media (max-width: 480px) { #prompt-helper-content .ph-grid { grid-template-columns: 1fr !important; } }
            `);
        }

        function applyUISettings(container){
            if(!container) return;
            container.style.setProperty('--ph-top', `${uiSettings.top}px`);
            container.style.setProperty('--ph-toggle-width', `${uiSettings.toggleWidth}px`);
            container.style.setProperty('--ph-toggle-height', `${uiSettings.toggleHeight}px`);
        }

        // —— 文本域/富文本工具 ——（保持原逻辑 + Claude 专用 html-direct）
        function resolveEditableTarget(el){
            if(!el) return null;
            const tag = el.tagName?.toLowerCase?.();
            if(tag==='textarea' || tag==='input') return el;
            if(el.getAttribute?.('contenteditable')==='true' || el.isContentEditable) return el;
            const inner = el.querySelector?.('[contenteditable="true"], textarea, input, [role="textbox"]');
            return inner || el;
        }
        function clearEditableContent(el){
            el = resolveEditableTarget(el);
            if(!el) return;
            try{
                el.focus();
                try{ document.execCommand('selectAll', false, null); }catch(_){}
                ['keydown','keypress','keyup'].forEach((t,i)=>{
                    const ev = tryCreateKeyboardEvent(t,{bubbles:true,cancelable:true,key:'a',code:'KeyA',ctrlKey:true,metaKey:navigator.platform.includes('Mac')});
                    setTimeout(()=>{ try{ el.dispatchEvent(ev);}catch(_){ } }, i*5);
                });
                try{ el.dispatchEvent(tryCreateInputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'deleteByCut',data:''})); }catch(_){}
                try{ el.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:true,inputType:'deleteByCut',data:''})); }catch(_){}
                try{ document.execCommand('delete'); }catch(_){}
                try{ el.innerHTML=''; }catch(_){ try{ el.textContent=''; }catch(__){} }
                try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){}
                try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
            }catch(e){
                try{ el.innerHTML=''; }catch(_){ try{ el.textContent=''; }catch(__){} }
                try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){}
                try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
            }
        }
        function replaceContentEditable(el, text, opts={}){
            el = resolveEditableTarget(el);
            if(!el) return;
            const mode = opts.mode || 'default';
            const clearBefore = !!opts.clearBefore;
            const pmStrict = !!opts.pmStrict;

            try{
                el.focus();
                if(clearBefore){
                    clearEditableContent(el);
                }
                const sel = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(el);
                sel.removeAllRanges();
                sel.addRange(range);

                if(mode === 'html-direct'){
                    const html = pmStrict ? textToProseMirrorParagraphHTML(text)
                                          : textToHtmlPreserveBlankLines(text);
                    let ok = false;
                    try{
                        ok = document.execCommand('insertHTML', false, html);
                    }catch(_){ ok = false; }
                    if(!ok){
                        try{ el.innerHTML = html; }catch(__){ el.textContent = text; }
                    }
                } else if(mode === 'paste-only'){
                    let ok=false;
                    try{
                        const html = pmStrict ? textToProseMirrorParagraphHTML(text)
                                              : textToHtmlPreserveBlankLines(text);
                        const dt=new DataTransfer();
                        dt.setData('text/plain', text);
                        dt.setData('text/html', html);
                        const evt=new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:dt});
                        ok=el.dispatchEvent(evt);
                        if(!ok){ el.innerHTML = html; }
                    }catch(_){
                        try{ el.innerHTML = (pmStrict ? textToProseMirrorParagraphHTML(text) : textToHtmlPreserveBlankLines(text)); }
                        catch(__){ el.textContent = text; }
                    }
                } else {
                    try { document.execCommand('insertText', false, text); } catch(_) {}
                    pasteIntoProseMirror(el, text, { pmStrict });
                }

                el.dispatchEvent(new Event('input',{bubbles:true}));
                el.dispatchEvent(new Event('change',{bubbles:true}));
                ['compositionstart','compositionupdate','compositionend'].forEach(t=>el.dispatchEvent(new Event(t,{bubbles:true})));
            }catch(e){
                try{ el.textContent = text; }catch(_){}
                el.dispatchEvent(new Event('input',{bubbles:true}));
                el.dispatchEvent(new Event('change',{bubbles:true}));
            }
        }

        // —— 导出/导入相关工具（新增打包 schema + 兼容旧文件） ——
        function nowStamp(){
            const d=new Date(); const p=n=>String(n).padStart(2,'0');
            return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
        }
        function downloadJSON(filename, obj){
            const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url; a.download=filename; document.body.appendChild(a); a.click();
            setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
        }
        function ensureUniqueName(baseName, existingSet){
            if(!existingSet.has(baseName)) return baseName;
            let candidate = `${baseName}${IMPORT_SUFFIX_BASE}`;
            if(!existingSet.has(candidate)) return candidate;
            let i=2;
            while(existingSet.has(`${baseName}${IMPORT_SUFFIX_BASE} ${i}`)) i++;
            return `${baseName}${IMPORT_SUFFIX_BASE} ${i}`;
        }
        function genId(prefix='id'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
        function normalizeImportedList(parsed){
            if(!parsed) return [];
            if(Array.isArray(parsed)) return parsed;
            if(Array.isArray(parsed.templates)) return parsed.templates;
            if(typeof parsed==='object'){
                const vals=Object.values(parsed).filter(v=>v && typeof v==='object' && 'name' in v && 'template' in v);
                if(vals.length) return vals;
            }
            return [];
        }
        function isBundlePayload(obj){
            if(!obj || typeof obj!=='object') return false;
            if(obj.schema === EXPORT_SCHEMA_BUNDLE) return true;
            const data = obj.data;
            if(data && typeof data==='object' && (Array.isArray(data.templates) || Array.isArray(data.siteDefaults) || typeof data.uiSettings==='object')) return true;
            return false;
        }
        function buildExportBundlePayload(){
            // 最新模板（含默认补齐）
            let latestPrompts = {};
            const s=GM_getValue(PROMPTS_STORE_KEY,null);
            if(s){ try{ latestPrompts=JSON.parse(s)||{}; }catch{ latestPrompts={}; } }
            if(!latestPrompts[DEFAULT_TEMPLATE_ID]) latestPrompts[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID];

            // 导出非默认模板（保持既有行为）
            const templates = [];
            for(const id in latestPrompts){
                if(id===DEFAULT_TEMPLATE_ID) continue;
                const name=(latestPrompts[id]?.name||'').trim();
                const template=(latestPrompts[id]?.template||'').trim();
                if(name && template) templates.push({ name, template });
            }

            // 最新站点规则
            const rules = loadSiteDefaults().map(r=>{
                const tplName = latestPrompts[r.templateId]?.name || '';
                return {
                    pattern: r.pattern || '',
                    templateName: tplName || null,  // 以模板名为主，以便导入后重新映射新 id
                    templateId: r.templateId || null, // 兼容字段（辅助）
                    createdAt: r.createdAt || null
                };
            });

            // UI 设置
            const ui = loadUISettings();

            return {
                app: 'PromptHelper',
                schema: EXPORT_SCHEMA_BUNDLE,
                version: 1,
                exportedAt: new Date().toISOString(),
                data: {
                    templates,
                    siteDefaults: rules,
                    uiSettings: { top: ui.top, toggleWidth: ui.toggleWidth, toggleHeight: ui.toggleHeight }
                }
            };
        }
        function importBundleObject(payload, i18n){
            // 解析 data 节点
            const data = payload.data || {};
            const incomingTemplates = Array.isArray(data.templates) ? data.templates : [];
            const incomingRules = Array.isArray(data.siteDefaults) ? data.siteDefaults : [];
            const incomingUI = (data.uiSettings && typeof data.uiSettings==='object') ? data.uiSettings : null;

            // —— 1) 导入模板（读-改-写 + 重名处理） ——
            let latest=(function(){ let l={}; const s=GM_getValue(PROMPTS_STORE_KEY,null); if(s){ try{ l=JSON.parse(s)||{}; }catch{ l={}; } } if(!l[DEFAULT_TEMPLATE_ID]) l[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID]; return l; })();
            const existingNames=new Set(Object.values(latest).map(p=>p.name));
            let added=0, renamed=0;

            // name -> newId 映射（用于规则重映射）
            const nameToNewId = {};

            for(const item of incomingTemplates){
                if(!item) continue;
                const name=String(item.name||'').trim();
                const body=String(item.template||'').trim();
                if(!name || !body) continue;
                let finalName=name;
                if(existingNames.has(finalName)){ finalName=ensureUniqueName(name, existingNames); if(finalName!==name) renamed++; }
                const id=genId('prompt');
                latest[id]={name:finalName, template:body};
                existingNames.add(finalName);
                nameToNewId[name] = id;          // 原名 → 新 id
                nameToNewId[finalName] = id;     // 处理重命名后的名也指向新 id
                added++;
            }
            GM_setValue(PROMPTS_STORE_KEY, JSON.stringify(latest));
            // 刷到内存对象
            let promptsLatest = {};
            try{ promptsLatest = JSON.parse(GM_getValue(PROMPTS_STORE_KEY,null)) || latest; }catch{ promptsLatest = latest; }

            // —— 2) 导入站点规则（追加，不覆盖；模板 id 重新解析） ——
            let rulesLatest = loadSiteDefaults();
            let rulesAdded = 0;

            function resolveTemplateIdForRule(rule){
                // 优先：以模板名映射到刚导入的新 id
                const byName = (rule && rule.templateName) ? nameToNewId[rule.templateName] : null;
                if(byName && promptsLatest[byName]) return byName;
                // 次选：当前库中存在同名模板
                if(rule && rule.templateName){
                    const foundId = Object.keys(promptsLatest).find(id => promptsLatest[id]?.name === rule.templateName);
                    if(foundId) return foundId;
                }
                // 兼容字段：原 templateId 还存在且有效
                if(rule && rule.templateId && promptsLatest[rule.templateId]) return rule.templateId;
                // 兜底：默认模板
                return DEFAULT_TEMPLATE_ID;
            }

            for(const r of incomingRules){
                if(!r || !r.pattern) continue;
                const resolvedId = resolveTemplateIdForRule(r);
                rulesLatest.push({
                    id: genId('map'),
                    pattern: String(r.pattern||'').trim(),
                    templateId: resolvedId,
                    createdAt: r.createdAt || Date.now()
                });
                rulesAdded++;
            }
            saveSiteDefaults(rulesLatest);
            siteDefaults = loadSiteDefaults();

            // —— 3) 导入 UI 设置（存在则立即应用并持久化） ——
            let uiApplied = false;
            if(incomingUI && (typeof incomingUI.top==='number' || typeof incomingUI.toggleWidth==='number' || typeof incomingUI.toggleHeight==='number')){
                const top = Number.isFinite(incomingUI.top) ? Math.max(0, incomingUI.top|0) : uiSettings.top;
                const tw  = Number.isFinite(incomingUI.toggleWidth) ? Math.max(40, incomingUI.toggleWidth|0) : uiSettings.toggleWidth;
                const th  = Number.isFinite(incomingUI.toggleHeight) ? Math.max(24, incomingUI.toggleHeight|0) : uiSettings.toggleHeight;
                uiSettings = { top, toggleWidth: tw, toggleHeight: th };
                saveUISettings(uiSettings);
                applyUISettings(document.getElementById('prompt-helper-container'));
                uiApplied = true;
            }

            return { added, renamed, rulesAdded, uiApplied };
        }

        function getCurrentSiteConfig(){ const hostname=window.location.hostname; for(const key in siteConfigs){ if(hostname.includes(key)) return siteConfigs[key]; } return null; }
        function resolveEditableTargetWrapper(el){ return resolveEditableTarget(el); }
        function findInputElement(){
            const siteConfig=getCurrentSiteConfig(); if(!siteConfig){return null;}
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
            inputElement = resolveEditableTargetWrapper(inputElement);
            return inputElement;
        }
        function getTextFromEditable(el){
            el = resolveEditableTarget(el);
            if(!el) return '';
            const tag=el.tagName?.toLowerCase?.() || '';
            if(tag==='textarea' || tag==='input') return el.value || '';
            if(el.getAttribute?.('contenteditable')==='true' || el.isContentEditable){
                let t = (el.innerText!==undefined)? el.innerText : (el.textContent||'');
                return t.replace(/\u200B/g,'').replace(/\s+$/,'');
            }
            return (el.value || el.textContent || '').trim();
        }
        function isKimiSite(){ const h=location.hostname; return h.includes('kimi.moonshot.cn')||h.includes('kimi.com')||h.includes('www.kimi.com'); }
        function isClaudeSite(){ const h=location.hostname; return h.includes('claude.ai')||h.includes('fuclaude.com'); }

        function patternToRegex(pat){
            const esc = String(pat||'').toLowerCase().replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');
            return new RegExp('^'+esc+'$','i');
        }
        function matchHostWithPattern(host, pat){
            if(!host || !pat) return false;
            const re = patternToRegex(pat);
            return re.test(String(host).toLowerCase());
        }

        function applyPromptToChat(inputElement, finalPrompt){
            inputElement = resolveEditableTarget(inputElement);

            if(inputElement.tagName?.toLowerCase?.()==='textarea'){
                if(location.hostname.includes('tongyi.com')){
                    const reactKey=Object.keys(inputElement).find(key=>key.startsWith('__reactInternalInstance')||key.startsWith('__reactFiber')||key.startsWith('__reactProps'));
                    if(reactKey){ try{
                        const fiberNode=inputElement[reactKey];
                        const possiblePaths=[fiberNode?.memoizedProps?.onChange,fiberNode?.return?.memoizedProps?.onChange,fiberNode?.return?.return?.memoizedProps?.onChange,fiberNode?.pendingProps?.onChange];
                        for(const onChange of possiblePaths){ if(onChange&&typeof onChange==='function'){ const fakeEvent={target:{value:finalPrompt},currentTarget:{value:finalPrompt},preventDefault:()=>{},stopPropagation:()=>{}}; onChange(fakeEvent); break; } }
                    }catch(e){ console.log('[PromptHelper] React状态操作失败:',e);} }
                    inputElement.focus(); inputElement.value=''; inputElement.value=finalPrompt;
                    try{ Object.defineProperty(inputElement,'value',{value:finalPrompt,writable:true,configurable:true}); }catch(_){}
                    [ new Event('focus',{bubbles:true}),
                      tryCreateInputEvent('beforeinput',{bubbles:true,cancelable:true,data:finalPrompt,inputType:'insertText'}),
                      tryCreateInputEvent('input',{bubbles:true,cancelable:true,data:finalPrompt,inputType:'insertText'}),
                      new Event('change',{bubbles:true}),
                      tryCreateKeyboardEvent('keydown',{bubbles:true,key:'a'}),
                      tryCreateKeyboardEvent('keyup',{bubbles:true,key:'a'}),
                      new Event('blur',{bubbles:true})
                    ].forEach((ev,i)=>setTimeout(()=>inputElement.dispatchEvent(ev),i*10));
                    setTimeout(()=>{ if(inputElement.value!==finalPrompt) inputElement.value=finalPrompt; inputElement.blur(); setTimeout(()=>{ inputElement.focus(); inputElement.value=finalPrompt; inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:true,data:finalPrompt,inputType:'insertText'})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); inputElement.dispatchEvent(new Event('propertychange',{bubbles:true})); window.dispatchEvent(new Event('resize')); },50); },150);
                } else if(location.hostname.includes('grok.com')){
                    inputElement.focus(); setNativeValue(inputElement,''); inputElement.dispatchEvent(new Event('input',{bubbles:true})); setNativeValue(inputElement,finalPrompt);
                    try{ inputElement.setAttribute('value',finalPrompt);}catch(_){} inputElement.dispatchEvent(tryCreateInputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertFromPaste',data:finalPrompt})); inputElement.dispatchEvent(new Event('input',{bubbles:true})); inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText',data:finalPrompt})); inputElement.dispatchEvent(new Event('change',{bubbles:true}));
                    ['keydown','keypress','keyup'].forEach(type=>inputElement.dispatchEvent(tryCreateKeyboardEvent(type,{bubbles:true,cancelable:true,key:'a',code:'KeyA'})));
                    try{ inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);}catch(_){}
                    setTimeout(()=>{ inputElement.dispatchEvent(new Event('input',{bubbles:true})); inputElement.dispatchEvent(new Event('change',{bubbles:true})); },50);
                } else {
                    if(location.hostname.includes('openai.com')||location.hostname.includes('chatgpt.com')){
                        inputElement.value=finalPrompt;
                        const isChrome=navigator.userAgent.includes('Chrome')&&!navigator.userAgent.includes('Firefox');
                        if(isChrome){
                            setTimeout(()=>{
                                inputElement.focus(); inputElement.value=finalPrompt;
                                if(typeof inputElement.setSelectionRange==='function') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);
                                inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:false,inputType:'insertText'}));
                                let protectionCount=0;
                                const protect=()=>{ if(protectionCount<20){ const cur=inputElement.value; if(cur.replace(/\n/g,'')===finalPrompt.replace(/\n/g,'')&&!cur.includes('\n')&&finalPrompt.includes('\n')){ inputElement.value=finalPrompt; if(typeof inputElement.setSelectionRange==='function') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length); inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:false,inputType:'insertText'})); } protectionCount++; setTimeout(protect,100);} };
                                setTimeout(protect,100);
                            },50);
                        } else {
                            inputElement.dispatchEvent(new Event('input',{bubbles:true}));
                            if(typeof inputElement.setSelectionRange==='function') inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);
                        }
                    } else { inputElement.value=finalPrompt; }
                    if(location.hostname.includes('deepseek.com')){
                        const parentDiv=inputElement.parentElement;
                        if(parentDiv){
                            let displayDiv=parentDiv.querySelector('.b13855df');
                            if(!displayDiv){
                                const allDivs=parentDiv.querySelectorAll('div');
                                for(const div of allDivs){ if(!div.classList.contains('_24fad49')&&div!==parentDiv){ displayDiv=div; break; } }
                            }
                            if(displayDiv){
                                displayDiv.innerHTML=''; finalPrompt.split('\n').forEach((line,idx)=>{ if(idx>0) displayDiv.appendChild(document.createElement('br')); displayDiv.appendChild(document.createTextNode(line)); });
                            }
                        }
                    }
                }
            } else if(inputElement.getAttribute && (inputElement.getAttribute('contenteditable')==='true' || inputElement.isContentEditable)){
                if(isKimiSite()){
                    replaceContentEditable(inputElement, finalPrompt, { mode: 'paste-only', clearBefore: true });
                } else if(isClaudeSite()){
                    replaceContentEditable(inputElement, finalPrompt, { mode: 'html-direct', clearBefore: true, pmStrict: true });
                } else if(location.hostname.includes('claude.ai')||location.hostname.includes('fuclaude.com')){
                    pasteIntoProseMirror(inputElement,finalPrompt,{pmStrict:true});
                    inputElement.dispatchEvent(new Event('input',{bubbles:true}));
                    inputElement.dispatchEvent(new Event('change',{bubbles:true}));
                } else {
                    if(location.hostname.includes('openai.com')||location.hostname.includes('chatgpt.com')){
                        inputElement.innerHTML='';
                        const lines=finalPrompt.split('\n');
                        lines.forEach((line,index)=>{ if(index>0) inputElement.appendChild(document.createElement('br')); if(line.length>0) inputElement.appendChild(document.createTextNode(line)); else if(index<lines.length-1) inputElement.appendChild(document.createElement('br')); });
                        const isChrome=navigator.userAgent.includes('Chrome')&&!navigator.userAgent.includes('Firefox');
                        if(isChrome){
                            const needEscape=(location.hostname.includes('openai.com')||location.hostname.includes('chatgpt.com'));
                            const htmlWithBreaks=needEscape?escapeHtml(finalPrompt).replace(/\n/g,'<br>'):finalPrompt.replace(/\n/g,'<br>');
                            setTimeout(()=>{
                                inputElement.focus(); inputElement.innerHTML=htmlWithBreaks;
                                const range=document.createRange(); const sel=window.getSelection();
                                range.selectNodeContents(inputElement); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
                                inputElement.dispatchEvent(tryCreateInputEvent('input',{bubbles:true,cancelable:false,inputType:'insertFromPaste'}));
                                let protectionCount=0;
                                const protect=()=>{ if(protectionCount<20){ const currentHtml=inputElement.innerHTML; const currentText=inputElement.textContent||inputElement.innerText;
                                    if(currentText.replace(/\n/g,'')===finalPrompt.replace(/\n/g,'')&&!currentHtml.includes('<br>')&&finalPrompt.includes('\n')){
                                        inputElement.innerHTML=htmlWithBreaks;
                                        try{ const r=document.createRange(); const s=window.getSelection(); r.selectNodeContents(inputElement); r.collapse(false); s.removeAllRanges(); s.addRange(r);}catch(_){}
                                    }
                                    protectionCount++; setTimeout(protect,100);
                                }};
                                setTimeout(protect,100);
                            },50);
                        }
                    } else { inputElement.textContent=finalPrompt; }
                }
            } else {
                if('value' in inputElement) inputElement.value=finalPrompt;
                if(inputElement.textContent!==undefined) inputElement.textContent=finalPrompt;
                if(inputElement.innerText!==undefined) inputElement.innerText=finalPrompt;
            }

            const commonEvents = (isKimiSite() || isClaudeSite())
                ? ['input','change','keydown','keyup']
                : ['input','change','keydown','keyup','paste'];
            commonEvents.forEach(type=>{
                let ev; if(type==='input') ev=tryCreateInputEvent('input',{bubbles:true,cancelable:true,inputType:'insertText',data:finalPrompt});
                else if(type==='keydown'||type==='keyup') ev=tryCreateKeyboardEvent(type,{bubbles:true,cancelable:true,key:'a',code:'KeyA'});
                else ev=new Event(type,{bubbles:true,cancelable:true});
                try{ inputElement.dispatchEvent(ev); }catch(_){}
            });

            if(location.hostname.includes('deepseek.com')){
                ['keydown','keypress','keyup'].forEach(t=>inputElement.dispatchEvent(tryCreateKeyboardEvent(t,{bubbles:true,cancelable:true,key:'a',code:'KeyA',which:65,keyCode:65})));
                inputElement.dispatchEvent(new Event('compositionstart',{bubbles:true}));
                inputElement.dispatchEvent(new Event('compositionupdate',{bubbles:true}));
                inputElement.dispatchEvent(new Event('compositionend',{bubbles:true}));
            }

            inputElement.focus();
            if(inputElement.tagName && (inputElement.tagName.toLowerCase()==='textarea'||inputElement.type==='text')){
                try{ inputElement.setSelectionRange(finalPrompt.length,finalPrompt.length);}catch(_){}
            } else if(inputElement.getAttribute && inputElement.getAttribute('contenteditable')==='true'){
                const range=document.createRange(); const sel=window.getSelection();
                if(sel&&inputElement.childNodes.length>0){ range.selectNodeContents(inputElement); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);}
            }

            setTimeout(()=>{
                try{ inputElement.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){}
                try{ inputElement.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
            },100);

            const specialSites=['deepseek.com','tongyi.com','yuanbao.tencent.com','aistudio.google.com','doubao.com'];
            const currentSite=specialSites.find(site=>location.hostname.includes(site));
            if(currentSite){
                setTimeout(()=>{
                    const reactKey=Object.keys(inputElement).find(key=>key.startsWith('__reactInternalInstance')||key.startsWith('__reactFiber'));
                    if(reactKey){
                        try{
                            const fiberNode=inputElement[reactKey];
                            if(fiberNode&&fiberNode.memoizedProps&&typeof fiberNode.memoizedProps.onChange==='function'){
                                const fakeEvent={target:{value:finalPrompt},currentTarget:{value:finalPrompt},preventDefault:()=>{},stopPropagation:()=>{}};
                                fiberNode.memoizedProps.onChange(fakeEvent);
                            }
                        }catch(e){ console.log(`[PromptHelper] ${currentSite} React状态更新失败:`,e); }
                    }
                    setTimeout(()=>{ if('value' in inputElement && inputElement.value!==finalPrompt){ inputElement.value=finalPrompt; inputElement.dispatchEvent(new Event('input',{bubbles:true})); } },300);
                },500);
            }
        }

        function getFinalFromChatByTemplateStr(templateStr){
            if(!templateStr) return {error:'no_template'};
            const inputEl = findInputElement(); if(!inputEl) return {error:'no_input'};
            const userTyped = getTextFromEditable(inputEl); if(!userTyped) return {error:'no_user_input'};
            return { inputEl, final: templateStr.replace('{User Question}', userTyped) };
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
            D.quickApplyButton=document.createElement('button');
            D.quickApplyButton.id='prompt-helper-quickapply';

            D.contentPanel=create('div','prompt-helper-content',['hidden']);
            D.contentPanel.setAttribute('data-view','main');

            // 头部
            D.langToggleButton=create('button','ph-lang-toggle',[],{},[document.createTextNode('中/En')]);
            D.title=document.createElement('h3'); D.title.id='ph-title';

            D.themeButton=document.createElement('button'); D.themeButton.id='ph-theme-btn';
            D.settingsButton=document.createElement('button'); D.settingsButton.id='ph-settings-btn';
            D.settingsButton.appendChild(document.createTextNode('⚙️'));

            D.collapseButton=create('button','ph-collapse-btn',[],{id:'ph-collapse-btn'},[document.createTextNode('\u00d7')]);

            const rightBox=create('div',null,['ph-header-right'],{},[D.themeButton, D.settingsButton, D.collapseButton]);
            const header=create('div','ph-header',['ph-header'],{},[D.langToggleButton,D.title,rightBox]);

            // 主视图
            D.labelSelect=create('label','ph-label-select',[],{for:'ph-template-select'});
            D.templateSelect=create('select','ph-template-select');
            D.newBtn=create('button','ph-new-btn',['ph-btn-primary']);
            D.saveBtn=create('button','ph-save-btn',['ph-btn-success']);
            D.deleteBtn=create('button','ph-delete-btn',['ph-btn-danger']);
            const section1=create('div',null,['ph-section'],{},[
                D.labelSelect,D.templateSelect,
                create('div',null,['ph-button-group'],{},[D.newBtn,D.saveBtn,D.deleteBtn])
            ]);
            D.labelName=create('label','ph-label-name',[],{for:'ph-template-name'});
            D.templateNameInput=create('input','ph-template-name',[],{type:'text'});
            D.labelContent=create('label','ph-label-content',[],{for:'ph-template-body'});
            D.templateBodyTextarea=create('textarea','ph-template-body');
            const section2=create('div',null,['ph-section'],{},[
                D.labelName,D.templateNameInput,D.labelContent,D.templateBodyTextarea
            ]);
            D.copyBtn=create('button','ph-copy-btn',['ph-btn-secondary']);
            D.submitBtn=create('button','ph-submit-btn',['ph-btn-primary']);
            const sectionActions=create('div',null,['ph-section'],{},[
                create('div',null,['ph-button-group'],{},[D.copyBtn,D.submitBtn])
            ]);
            D.mainView = create('div','ph-main-view',[],{},[section1,section2,sectionActions]);

            // 设置视图 —— 基础
            D.importBtn=create('button','ph-import-btn',['ph-btn-secondary']);
            D.exportBtn=create('button','ph-export-btn',['ph-btn-secondary']);
            D.importFileInput=create('input','ph-import-file',[],{type:'file',accept:'.json,application/json',style:'display:none'});
            const sectionIO=create('div',null,['ph-section'],{},[
                create('div',null,['ph-button-group'],{},[D.importBtn,D.exportBtn]),
                D.importFileInput
            ]);
            D.settingsTitleEl = document.createElement('h4');
            D.settingsTitleEl.id='ph-settings-title';
            D.settingTopLabel = document.createElement('label'); D.settingTopLabel.htmlFor='ph-setting-top';
            D.settingTopInput = document.createElement('input'); D.settingTopInput.id='ph-setting-top'; D.settingTopInput.type='number'; D.settingTopInput.min='0'; D.settingTopInput.step='1';
            D.settingToggleWidthLabel = document.createElement('label'); D.settingToggleWidthLabel.htmlFor='ph-setting-toggle-width';
            D.settingToggleWidthInput = document.createElement('input'); D.settingToggleWidthInput.id='ph-setting-toggle-width'; D.settingToggleWidthInput.type='number'; D.settingToggleWidthInput.min='40'; D.settingToggleWidthInput.step='1';
            D.settingToggleHeightLabel = document.createElement('label'); D.settingToggleHeightLabel.htmlFor='ph-setting-toggle-height';
            D.settingToggleHeightInput = document.createElement('input'); D.settingToggleHeightInput.id='ph-setting-toggle-height'; D.settingToggleHeightInput.type='number'; D.settingToggleHeightInput.min='24'; D.settingToggleHeightInput.step='1';
            D.settingsSaveBtn = create('button','ph-settings-save',['ph-btn-success']);
            D.settingsResetBtn = create('button','ph-settings-reset',['ph-btn-secondary']);
            const settingsGrid = create('div','ph-settings-grid',['ph-grid'],{},[
                D.settingTopLabel, D.settingTopInput,
                D.settingToggleWidthLabel, D.settingToggleWidthInput,
                D.settingToggleHeightLabel, D.settingToggleHeightInput
            ]);
            const settingsButtons = create('div',null,['ph-button-group'],{},[D.settingsSaveBtn, D.settingsResetBtn]);

            // 设置视图 —— 站点默认模板
            D.siteTitle = document.createElement('h4'); D.siteTitle.id='ph-site-title';
            D.siteListLabel = document.createElement('label'); D.siteListLabel.htmlFor='ph-site-list';
            D.siteList = document.createElement('select'); D.siteList.id='ph-site-list';
            D.siteNewBtn = create('button','ph-site-new',['ph-btn-primary']);
            D.siteSaveBtn = create('button','ph-site-save',['ph-btn-success']);
            D.siteDeleteBtn = create('button','ph-site-del',['ph-btn-danger']);
            const siteListRow = create('div',null,['ph-section'],{},[
                D.siteListLabel, D.siteList,
                create('div',null,['ph-button-group'],{},[D.siteNewBtn, D.siteSaveBtn, D.siteDeleteBtn])
            ]);
            D.sitePatternLabel = document.createElement('label'); D.sitePatternLabel.htmlFor='ph-site-pattern';
            D.sitePatternInput = document.createElement('input'); D.sitePatternInput.id='ph-site-pattern'; D.sitePatternInput.type='text'; D.sitePatternInput.placeholder='e.g. *.example.com';
            D.siteTplLabel = document.createElement('label'); D.siteTplLabel.htmlFor='ph-site-tpl';
            D.siteTplSelect = document.createElement('select'); D.siteTplSelect.id='ph-site-tpl';
            const siteEditGrid = create('div','ph-site-grid',['ph-grid'],{},[
                D.sitePatternLabel, D.sitePatternInput,
                D.siteTplLabel, D.siteTplSelect
            ]);

            D.backBtn = create('button','ph-back-btn',['ph-btn-secondary'],{},[document.createTextNode('←')]);

            D.settingsView = document.createElement('div'); D.settingsView.id='ph-settings-view';
            D.settingsView.append(
                D.backBtn,
                D.siteTitle, siteListRow, siteEditGrid,
                D.settingsTitleEl, settingsGrid, settingsButtons,
                sectionIO
            );

            D.contentPanel.append(header, D.mainView, D.settingsView);
            const containerNodes = [D.toggleButton, D.quickApplyButton, D.contentPanel];
            container.append(...containerNodes);
            return {container,elements:D};
        }

        function buildAndInit(){
            const {container,elements:D}=buildUI();

            const addToDOM=()=>{ if(document.body){ document.body.appendChild(container); applyUISettings(container); container.setAttribute('data-theme', currentTheme);} else { setTimeout(addToDOM,100);} };
            addToDOM();

            function loadPromptsLatest(){
                let latest = {};
                const saved=GM_getValue(PROMPTS_STORE_KEY,null);
                if(saved){
                    try{ latest=JSON.parse(saved)||{}; }catch{ latest={}; }
                }
                const legacyIds=['prompt_1','prompt_2','prompt_3'];
                const legacyNames=new Set(['通用回答模板','代码评审模板','英文润色模板']);
                legacyIds.forEach(id=>{ if(id in latest) delete latest[id]; });
                for(const k of Object.keys(latest)){ if(legacyNames.has(latest[k]?.name)) delete latest[k]; }
                if(!latest[DEFAULT_TEMPLATE_ID]) latest[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID];
                return latest;
            }
            function savePromptsLatest(obj){
                GM_setValue(PROMPTS_STORE_KEY, JSON.stringify(obj||{}));
            }

            let prompts = loadPromptsLatest();

            function populateSiteTplSelect(){
                D.siteTplSelect.textContent='';
                for(const id in prompts){
                    const opt=document.createElement('option');
                    opt.value=id; opt.textContent=prompts[id].name || id;
                    D.siteTplSelect.appendChild(opt);
                }
            }
            function populateSiteList(){
                const t = translations[currentLang];
                D.siteList.textContent='';
                const noneOpt=document.createElement('option');
                noneOpt.value=''; noneOpt.textContent='-- ' + t.siteDefaultsList + ' --';
                D.siteList.appendChild(noneOpt);
                siteDefaults.forEach(rule=>{
                    const name = prompts[rule.templateId]?.name || `[${rule.templateId}]`;
                    const opt=document.createElement('option');
                    opt.value=rule.id; opt.textContent=`${rule.pattern}  →  ${name}`;
                    D.siteList.appendChild(opt);
                });
            }
            function clearSiteEditFields(){
                D.siteList.value='';
                D.sitePatternInput.value='';
                if(D.siteTplSelect.options.length>0) D.siteTplSelect.selectedIndex=0;
            }
            function loadSiteRuleToFields(rule){
                if(!rule) return clearSiteEditFields();
                D.sitePatternInput.value = rule.pattern || '';
                if(rule.templateId && prompts[rule.templateId]) D.siteTplSelect.value = rule.templateId;
            }

            const populateDropdown=()=>{
                const currentSelection=D.templateSelect.value;
                D.templateSelect.textContent='';
                const defaultOption=document.createElement('option');
                defaultOption.value='';
                defaultOption.textContent=translations[currentLang].selectDefault;
                D.templateSelect.appendChild(defaultOption);
                if(prompts[DEFAULT_TEMPLATE_ID]){
                    const opt=document.createElement('option');
                    opt.value=DEFAULT_TEMPLATE_ID;
                    opt.textContent=prompts[DEFAULT_TEMPLATE_ID].name;
                    D.templateSelect.appendChild(opt);
                }
                for(const id in prompts){
                    if(id===DEFAULT_TEMPLATE_ID) continue;
                    const option=document.createElement('option');
                    option.value=id; option.textContent=prompts[id].name;
                    D.templateSelect.appendChild(option);
                }
                if(prompts[currentSelection]) D.templateSelect.value=currentSelection;
            };

            const displaySelectedPrompt=()=>{
                const selectedId=D.templateSelect.value;
                if(selectedId&&prompts[selectedId]){
                    D.templateNameInput.value=prompts[selectedId].name;
                    D.templateBodyTextarea.value=prompts[selectedId].template;
                } else {
                    D.templateNameInput.value=''; D.templateBodyTextarea.value='';
                }
                D.deleteBtn.disabled=(selectedId===DEFAULT_TEMPLATE_ID);
            };

            function getActiveDefaultTemplateId(promptsIn){
                const host = location.hostname.toLowerCase();
                for(const rule of siteDefaults){
                    if(rule && matchHostWithPattern(host, rule.pattern)){
                        if(rule.templateId && promptsIn[rule.templateId]){
                            return rule.templateId;
                        }
                    }
                }
                return DEFAULT_TEMPLATE_ID;
            }
            function applyActiveDefaultToMainSelect(){
                const activeId = getActiveDefaultTemplateId(prompts);
                if(prompts[activeId]) D.templateSelect.value = activeId;
                displaySelectedPrompt();
            }

            function updateThemeButtonUI(){
                const t = translations[currentLang];
                if(currentTheme==='dark'){
                    D.themeButton.textContent = '☀️';
                    D.themeButton.title = t.themeToggleDarkTitle;
                }else{
                    D.themeButton.textContent = '🌙';
                    D.themeButton.title = t.themeToggleLightTitle;
                }
            }

            const updateUI=()=>{
                const t=translations[currentLang];
                D.toggleButton.textContent=t.toggleButton; D.title.textContent=t.panelTitle;
                D.collapseButton.title=t.collapseTitle;
                D.settingsButton.title = t.settingsTitle;
                D.quickApplyButton.textContent = t.quickApplyBtn;

                updateThemeButtonUI();

                D.labelSelect.textContent=t.selectTemplate; D.newBtn.textContent=t.newBtn;
                D.saveBtn.textContent=t.saveBtn; D.deleteBtn.textContent=t.deleteBtn;
                D.labelName.textContent=t.templateName; D.templateNameInput.placeholder=t.templateNamePlaceholder;
                D.labelContent.textContent=t.templateContent;
                D.copyBtn.textContent=t.copyBtn; D.submitBtn.textContent=t.submitBtn;

                D.settingsTitleEl.textContent = t.settingsTitle;
                D.settingTopLabel.textContent = t.settingTop;
                D.settingToggleWidthLabel.textContent = t.settingToggleWidth;
                D.settingToggleHeightLabel.textContent = t.settingToggleHeight;
                D.settingsSaveBtn.textContent = t.settingsSave;
                D.settingsResetBtn.textContent = t.settingsReset;
                D.importBtn.textContent=t.importBtn; D.exportBtn.textContent=t.exportBtn;

                D.siteTitle.textContent = t.siteDefaultsTitle;
                D.siteListLabel.textContent = t.siteDefaultsList;
                D.sitePatternLabel.textContent = t.sitePattern;
                D.siteTplLabel.textContent = t.siteTemplate;
                D.siteNewBtn.textContent = t.siteNewBtn;
                D.siteSaveBtn.textContent = t.siteSaveBtn;
                D.siteDeleteBtn.textContent = t.siteDeleteBtn;

                populateDropdown();
                populateSiteTplSelect();
                populateSiteList();

                applyActiveDefaultToMainSelect();

                D.settingTopInput.value = uiSettings.top;
                D.settingToggleWidthInput.value = uiSettings.toggleWidth;
                D.settingToggleHeightInput.value = uiSettings.toggleHeight;

                document.getElementById('prompt-helper-container')?.setAttribute('data-theme', currentTheme);
            };

            updateUI();

            // 交互
            D.toggleButton.addEventListener('click',()=>D.contentPanel.classList.remove('hidden'));
            D.collapseButton.addEventListener('click',()=>D.contentPanel.classList.add('hidden'));
            D.langToggleButton.addEventListener('click',()=>{ currentLang=currentLang==='zh'?'en':'zh'; GM_setValue(LANG_STORE_KEY,currentLang); updateUI(); });
            D.settingsButton.addEventListener('click', ()=> D.contentPanel.setAttribute('data-view','settings'));
            D.backBtn.addEventListener('click', ()=> D.contentPanel.setAttribute('data-view','main'));

            // 主题切换（持久化）
            D.themeButton.addEventListener('click', ()=>{
                currentTheme = (currentTheme==='dark') ? 'light' : 'dark';
                saveTheme(currentTheme);
                document.getElementById('prompt-helper-container')?.setAttribute('data-theme', currentTheme);
                updateThemeButtonUI();
            });

            // 模板 CRUD（读-改-写，合并保存）
            D.templateSelect.addEventListener('change',displaySelectedPrompt);
            D.newBtn.addEventListener('click',()=>{
                D.templateSelect.value='';
                D.templateNameInput.value='';
                D.templateBodyTextarea.value='';
                D.templateNameInput.focus();
                D.deleteBtn.disabled=true;
            });
            D.saveBtn.addEventListener('click',()=>{
                const name=D.templateNameInput.value.trim();
                const templateText=D.templateBodyTextarea.value.trim();
                if(!name||!templateText){ alert(translations[currentLang].alertSaveError); return; }
                let latest = (function(){
                    let l={}; const s=GM_getValue(PROMPTS_STORE_KEY,null); if(s){ try{ l=JSON.parse(s)||{}; }catch{ l={}; } }
                    if(!l[DEFAULT_TEMPLATE_ID]) l[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID];
                    return l;
                })();
                let id = D.templateSelect.value || `prompt_${Date.now()}`;
                latest[id] = { name, template: templateText };
                GM_setValue(PROMPTS_STORE_KEY, JSON.stringify(latest));
                const saved=GM_getValue(PROMPTS_STORE_KEY,null);
                try{ prompts = JSON.parse(saved)||{}; }catch{ prompts = latest; }
                updateUI();
                D.templateSelect.value=id; displaySelectedPrompt();
                alert(`${translations[currentLang].alertSaveSuccess} "${name}"`);
            });
            D.deleteBtn.addEventListener('click',()=>{
                const id=D.templateSelect.value;
                if(!id){ alert(translations[currentLang].alertDeleteError); return; }
                if(id===DEFAULT_TEMPLATE_ID){ alert(translations[currentLang].alertCannotDeleteDefault); return; }
                if(confirm(`${translations[currentLang].alertDeleteConfirm} "${prompts[id].name}"?`)){
                    let latest = (function(){ let l={}; const s=GM_getValue(PROMPTS_STORE_KEY,null); if(s){ try{ l=JSON.parse(s)||{}; }catch{ l={}; } } return l; })();
                    delete latest[id];
                    if(!latest[DEFAULT_TEMPLATE_ID]) latest[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID];
                    GM_setValue(PROMPTS_STORE_KEY, JSON.stringify(latest));
                    const saved=GM_getValue(PROMPTS_STORE_KEY,null);
                    try{ prompts = JSON.parse(saved)||{}; }catch{ prompts = latest; }
                    updateUI();
                    D.templateSelect.value=DEFAULT_TEMPLATE_ID;
                    displaySelectedPrompt();
                }
            });

            // 复制（从聊天栏读取）
            D.copyBtn.addEventListener('click',()=>{
                const template=D.templateBodyTextarea.value;
                const res = getFinalFromChatByTemplateStr(template);
                if(res.error==='no_template'){ alert(translations[currentLang].alertTemplateError); return; }
                if(res.error==='no_input'){ alert(translations[currentLang].alertSubmitError); return; }
                if(res.error==='no_user_input'){ alert(translations[currentLang].alertNoUserInput); return; }
                navigator.clipboard.writeText(res.final).then(()=>{
                    const originalText=D.copyBtn.textContent; D.copyBtn.textContent=translations[currentLang].copiedBtn; D.copyBtn.disabled=true;
                    setTimeout(()=>{ D.copyBtn.textContent=originalText; D.copyBtn.disabled=false; },2000);
                }).catch(err=>{ console.error('Copy failed:',err); alert(translations[currentLang].alertCopyError); });
            });

            // 基础设置保存/重置
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

            // 导出（升级为“打包导出”，兼容旧 UI 文案）
            D.exportBtn.addEventListener('click',()=>{
                // 若没有任何非默认模板，仍给出与旧版相同的“没有可导出的模板”提示
                let latest=(function(){ let l={}; const s=GM_getValue(PROMPTS_STORE_KEY,null); if(s){ try{ l=JSON.parse(s)||{}; }catch{ l={}; } } if(!l[DEFAULT_TEMPLATE_ID]) l[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID]; return l; })();
                const hasNonDefault = Object.keys(latest).some(id => id!==DEFAULT_TEMPLATE_ID && (latest[id]?.name||'').trim() && (latest[id]?.template||'').trim());
                if(!hasNonDefault){
                    alert(translations[currentLang].alertExportEmpty);
                    return;
                }
                const payload = buildExportBundlePayload();
                const filename=`prompthelper-backup-${nowStamp()}.json`;
                downloadJSON(filename, payload);
                alert(translations[currentLang].alertExportDone + filename);
            });

            // 导入（兼容：bundle & 仅模板）
            D.importBtn.addEventListener('click',()=> D.importFileInput.click());
            D.importFileInput.addEventListener('change',(evt)=>{
                const file=evt.target.files && evt.target.files[0];
                if(!file) return;
                const reader=new FileReader();
                reader.onerror=()=>alert(translations[currentLang].alertImportInvalid);
                reader.onload=()=>{
                    try{
                        const text=String(reader.result||'').trim();
                        if(!text){ alert(translations[currentLang].alertImportInvalid); return; }
                        let parsed = null;
                        try{ parsed = JSON.parse(text); }catch(e){ parsed = null; }

                        // 新版 bundle
                        if(isBundlePayload(parsed)){
                            const { added, renamed, rulesAdded, uiApplied } = importBundleObject(parsed, translations[currentLang]);
                            // 刷新内存与 UI
                            try{ prompts = JSON.parse(GM_getValue(PROMPTS_STORE_KEY,null)) || prompts; }catch{}
                            siteDefaults = loadSiteDefaults();
                            updateUI();
                            // 统一提示（不新增翻译键，按语言输出）
                            if(currentLang==='zh'){
                                alert(`导入完成：模板 ${added} 个（重命名 ${renamed} 个）；规则 ${rulesAdded} 条；${uiApplied?'已应用按钮位置设置。':'无按钮位置设置或未变更。'}`);
                            }else{
                                alert(`Import complete: templates ${added} (renamed ${renamed}); rules ${rulesAdded}; ${uiApplied?'UI position applied.':'No UI position provided or unchanged.'}`);
                            }
                            D.importFileInput.value='';
                            return;
                        }

                        // 老格式：仅模板
                        const arr=normalizeImportedList(parsed);
                        if(!arr.length){ alert(translations[currentLang].alertImportInvalid); return; }

                        let latest=(function(){ let l={}; const s=GM_getValue(PROMPTS_STORE_KEY,null); if(s){ try{ l=JSON.parse(s)||{}; }catch{ l={}; } } if(!l[DEFAULT_TEMPLATE_ID]) l[DEFAULT_TEMPLATE_ID]=defaultPrompts[DEFAULT_TEMPLATE_ID]; return l; })();
                        const existingNames=new Set(Object.values(latest).map(p=>p.name));
                        let added=0, renamed=0;
                        for(const item of arr){
                            if(!item) continue;
                            const name=String(item.name||'').trim();
                            const body=String(item.template||'').trim();
                            if(!name || !body) continue;
                            let finalName=name;
                            if(existingNames.has(finalName)){ finalName=ensureUniqueName(name, existingNames); if(finalName!==name) renamed++; }
                            const id=genId('prompt');
                            latest[id]={name:finalName, template:body};
                            existingNames.add(finalName);
                            added++;
                        }
                        GM_setValue(PROMPTS_STORE_KEY, JSON.stringify(latest));
                        const saved=GM_getValue(PROMPTS_STORE_KEY,null);
                        try{ prompts = JSON.parse(saved)||{}; }catch{ prompts = latest; }
                        updateUI();
                        alert(translations[currentLang].alertImportDone(added,renamed));
                        D.importFileInput.value='';
                    }catch(e){
                        console.error(e);
                        alert(translations[currentLang].alertImportInvalid);
                    }
                };
                reader.readAsText(file,'utf-8');
            });

            // 站点默认模板（读-改-写，仅改动目标条目）
            function refreshSiteDefaultsFromStore(){
                siteDefaults = loadSiteDefaults();
            }
            D.siteNewBtn.addEventListener('click', ()=> {
                D.siteList.value='';
                D.sitePatternInput.value='';
                if(D.siteTplSelect.options.length>0) D.siteTplSelect.selectedIndex=0;
                D.sitePatternInput.focus();
            });
            D.siteSaveBtn.addEventListener('click', ()=>{
                const t = translations[currentLang];
                const pattern = (D.sitePatternInput.value||'').trim();
                const tplId = D.siteTplSelect.value;
                if(!pattern){ alert(t.alertSitePatternRequired); return; }
                if(!tplId){ alert(t.alertSiteTemplateRequired); return; }

                let latest = loadSiteDefaults();
                const selectedId = D.siteList.value;
                if(selectedId){
                    const idx = latest.findIndex(r=>r.id===selectedId);
                    if(idx>=0){
                        latest[idx] = { ...latest[idx], pattern, templateId: tplId };
                    }else{
                        latest.push({ id: selectedId, pattern, templateId: tplId, createdAt: Date.now() });
                    }
                }else{
                    latest.push({ id: genId('map'), pattern, templateId: tplId, createdAt: Date.now() });
                }
                saveSiteDefaults(latest);

                refreshSiteDefaultsFromStore();
                populateSiteList();
                alert(t.alertSiteSaved);

                const activeId = (function(promptsIn){
                    const host = location.hostname.toLowerCase();
                    for(const rule of siteDefaults){
                        if(rule && matchHostWithPattern(host, rule.pattern)){
                            if(rule.templateId && promptsIn[rule.templateId]) return rule.templateId;
                        }
                    }
                    return DEFAULT_TEMPLATE_ID;
                })(prompts);
                if(prompts[activeId]) D.templateSelect.value=activeId;
                displaySelectedPrompt();
            });
            D.siteDeleteBtn.addEventListener('click', ()=>{
                const t = translations[currentLang];
                const selectedId = D.siteList.value;
                if(!selectedId){ alert(t.alertSiteSelectFirst); return; }
                let latest = loadSiteDefaults();
                const idx = latest.findIndex(r=>r.id===selectedId);
                if(idx>=0){ latest.splice(idx,1); }
                saveSiteDefaults(latest);

                siteDefaults = loadSiteDefaults();
                populateSiteList();
                D.siteList.value='';
                D.sitePatternInput.value='';
                if(D.siteTplSelect.options.length>0) D.siteTplSelect.selectedIndex=0;
                alert(t.alertSiteDeleted);

                const activeId = (function(promptsIn){
                    const host = location.hostname.toLowerCase();
                    for(const rule of siteDefaults){
                        if(rule && matchHostWithPattern(host, rule.pattern)){
                            if(rule.templateId && promptsIn[rule.templateId]) return rule.templateId;
                        }
                    }
                    return DEFAULT_TEMPLATE_ID;
                })(prompts);
                if(prompts[activeId]) D.templateSelect.value=activeId;
                displaySelectedPrompt();
            });
            D.siteList.addEventListener('change', ()=>{
                const id = D.siteList.value;
                const rule = siteDefaults.find(r=>r.id===id);
                if(!rule){
                    D.sitePatternInput.value='';
                    if(D.siteTplSelect.options.length>0) D.siteTplSelect.selectedIndex=0;
                    return;
                }
                D.sitePatternInput.value = rule.pattern || '';
                if(rule.templateId && prompts[rule.templateId]) D.siteTplSelect.value = rule.templateId;
            });

            // 应用（主按钮 & 快速应用）
            D.submitBtn.addEventListener('click',()=>{
                const template=D.templateBodyTextarea.value;
                const res = getFinalFromChatByTemplateStr(template);
                if(res.error==='no_template'){ alert(translations[currentLang].alertTemplateError); return; }
                if(res.error==='no_input'){ alert(translations[currentLang].alertSubmitError); return; }
                if(res.error==='no_user_input'){ alert(translations[currentLang].alertNoUserInput); return; }
                applyPromptToChat(res.inputEl, res.final);
                D.contentPanel.classList.add('hidden');
            });
            D.quickApplyButton.addEventListener('click', ()=>{
                const promptsSaved=GM_getValue(PROMPTS_STORE_KEY,null);
                let promptsLatest = prompts;
                if(promptsSaved){ try{ promptsLatest = JSON.parse(promptsSaved)||prompts; }catch{} }
                const activeId = (function(promptsIn){
                    const host = location.hostname.toLowerCase();
                    for(const rule of siteDefaults){
                        if(rule && matchHostWithPattern(host, rule.pattern)){
                            if(rule.templateId && promptsIn[rule.templateId]) return rule.templateId;
                        }
                    }
                    return DEFAULT_TEMPLATE_ID;
                })(promptsLatest);
                const tpl = (promptsLatest[activeId]?.template) || (defaultPrompts[DEFAULT_TEMPLATE_ID]?.template)||'';
                const res = getFinalFromChatByTemplateStr(tpl);
                if(res.error==='no_template'){ alert(translations[currentLang].alertTemplateError); return; }
                if(res.error==='no_input'){ alert(translations[currentLang].alertSubmitError); return; }
                if(res.error==='no_user_input'){ alert(translations[currentLang].alertNoUserInput); return; }
                applyPromptToChat(res.inputEl, res.final);
                document.querySelector('#prompt-helper-content')?.classList.add('hidden');
            });
        }

        function init(){
            if(document.getElementById('prompt-helper-container')) return;
            if(window.promptHelperInitialized) return;
            window.promptHelperInitialized=true;

            injectStyles();
            (function(){ buildAndInit(); })();
        }

        if(getCurrentSiteConfig()){ init(); }
    });
})();
