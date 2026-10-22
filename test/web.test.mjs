import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { test } from "node:test";
import ts from "typescript";

const chrome = [process.env.CHROME_BIN, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ...(process.env.PATH ?? "").split(delimiter).flatMap((dir) => ["google-chrome", "chromium", "chromium-browser"].map((name) => join(dir, name)))].find((file) => file && existsSync(file));

test("DOM restyling, accordion transitions, and bottom following stay stable", { skip: chrome ? false : "Chrome not installed (set CHROME_BIN)" }, async () => {
  const temp = mkdtempSync(join(tmpdir(), "chat-polish-web-test-"));
  let server;
  try {
    const sources = Object.fromEntries(["chat-markdown-style", "css-guard", "message-entry-motion", "provider-icons", "streaming-token-motion", "web"].map((name) => [name, ts.transpileModule(readFileSync(new URL(`../client/${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText]));
    // Paseo's bundle exports its mermaid document as a minified string literal, with JS-only escapes like \xHH.
    const bundle = String.raw`Object.defineProperty(a,"mermaidRuntimeHtml",{get:function(){return o}});const o='<!doctype html>\n<p class="x" title=\'y\'>\x3c!-- __PASEO_MERMAID_RUNTIME_RECEIVE__ \\x41 \u0041 \u{1F600} \v \/ --\x3e</p>';`;
    const mermaidDoc = "<!doctype html>\n<p class=\"x\" title='y'><!-- __PASEO_MERMAID_RUNTIME_RECEIVE__ \\x41 A \u{1F600} \v / --></p>";
    const html = `<!doctype html><html><head><title>pending</title><script type="text/plain" src="/bundle.js"></script></head><body><img src="/hold" hidden>
      <div data-testid="settings-detail-pane"></div>
      <div data-testid="context-window-details" style="position:absolute;border:1px solid black;border-radius:12px;background:white"><div><span>Context</span><span>35% used</span></div><div data-testid="usage-report-test" style="height:180px">Usage</div></div>
      <div data-testid="assistant-message"><div data-paseo-markdown-tag="blockquote"><span id="marker">[!NO</span></div></div>
      <div data-testid="agent-chat-scroll" id="stream-chat" style="width:220px;height:120px;overflow:auto;background:#111;color:black"><div data-testid="agent-chat-content"><div data-testid="agent-chat-timeline"><div style="height:150px;flex-shrink:0"></div><div data-history-row-id="stream-row"><div data-testid="assistant-message" data-reveal-length="5"><div class="enrm-text"><p><span id="stream-text" style="color:rgb(240, 241, 242)">Hello</span></p></div></div></div></div><div><div data-testid="turn-working-indicator">Working</div></div></div></div>
      <script>
        const checks = {}; const errors = [];
        window.onerror = (message) => errors.push(String(message));
        const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));
        const animationsOf = (surface) => [surface, ...surface.children].flatMap((element) => element.getAnimations());
        const NativeObserver = MutationObserver; let batches = 0; let capped = false;
        window.MutationObserver = class extends NativeObserver {
          constructor(cb) { super((records) => { if (++batches > 60) { capped = true; this.disconnect(); } else cb(records); }); }
        };
        let released = 0;
        const remove = EventTarget.prototype.removeEventListener;
        EventTarget.prototype.removeEventListener = function(type, ...args) {
          if (type === 'click' && this.hasAttribute?.('data-chat-polish-clamp') && !this.isConnected) released++;
          return remove.call(this, type, ...args);
        };
        function prompts() {
          const list = document.createElement('section');
          for (let i = 0; i < 10; i++) {
            const message = document.createElement('div'); message.dataset.testid = 'user-message';
            message.innerHTML = '<div><div><div style="line-height:20px;font-size:14px;white-space:pre">' + Array(15).fill('long prompt').join('\\n') + '</div></div></div>';
            list.appendChild(message);
          }
          document.body.appendChild(list); return list;
        }
        const sources = ${JSON.stringify(sources)}; const modules = {};
        function load(name) {
          if (modules[name]) return modules[name];
          const exports = modules[name] = {};
          new Function('exports', 'require', sources[name])(exports, (id) => id === 'react-native' ? { Platform: { OS: 'web' } } : load(id.slice(2)));
          return exports;
        }
        (async () => {
          localStorage.removeItem('chat-polish:context-card-heights');
          const first = prompts(); const web = load('web');
          const streamChat = document.getElementById('stream-chat');
          streamChat.scrollTop = streamChat.scrollHeight;
          document.querySelector('[data-testid="turn-working-indicator"]').remove();
          let motionEnabled = true, syncMotion;
          const restyle = web.restyleNative(() => true); const clamp = web.clampUserMessages(() => true); const smooth = web.smoothStreamingText(() => motionEnabled, (listener) => (syncMotion = listener, () => {}));
          checks.mermaidDocFromBundle = (await web.loadMermaidDoc()) === new TextDecoder().decode(Uint8Array.from(atob("${Buffer.from(mermaidDoc).toString("base64")}"), (ch) => ch.charCodeAt(0)));
          await wait(); checks.observerSettles = !capped;
          const clampedBubble = first.querySelector('[data-chat-polish-clamp]');
          const clampedText = clampedBubble.lastElementChild;
          const clampedHeight = clampedText.getBoundingClientRect().height;
          clampedBubble.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const openingAnimations = clampedText.getAnimations();
          openingAnimations.forEach((animation) => { animation.pause(); animation.currentTime = 110; });
          const openingHeight = clampedText.getBoundingClientRect().height;
          openingAnimations.forEach((animation) => animation.finish());
          const expandedHeight = clampedText.getBoundingClientRect().height;
          clampedBubble.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          const closingAnimations = clampedText.getAnimations();
          closingAnimations.forEach((animation) => { animation.pause(); animation.currentTime = 110; });
          const closingHeight = clampedText.getBoundingClientRect().height;
          closingAnimations.forEach((animation) => animation.finish());
          checks.clampedBubbleUsesDisclosureMotion = openingAnimations.length > 0
            && openingHeight > clampedHeight && openingHeight < expandedHeight
            && closingAnimations.length > 0 && closingHeight > clampedHeight && closingHeight < expandedHeight;
          streamChat.querySelector('[data-testid="assistant-message"]').dataset.revealLength = '11';
          document.getElementById('stream-text').firstChild.nodeValue = 'Hello world';
          await wait(30);
          const streamReveal = document.querySelector('[data-cp-stream-reveal]');
          checks.streamingTextUsesRendererPaint = !streamReveal
            && !document.querySelector('[data-cp-stream-blur-style]');
          streamReveal?.remove();
          await wait(100);
          checks.streamingPaintStaysCoverFree = !document.querySelector('[data-cp-stream-reveal]');
          const oldStreamRow = document.querySelector('[data-history-row-id="stream-row"]');
          const replacementStreamRow = oldStreamRow.cloneNode(true);
          replacementStreamRow.querySelector('#stream-text').firstChild.nodeValue = 'Hello world again';
          replacementStreamRow.querySelector('[data-testid="assistant-message"]').dataset.revealLength = String('Hello world again'.length);
          oldStreamRow.replaceWith(replacementStreamRow);
          await wait(30);
          const replacementCover = document.querySelector('[data-cp-stream-reveal]');
          checks.replacedStreamingRowKeepsRendererPaint = !replacementCover;
          replacementCover?.remove();
          const repaintedAgain = replacementStreamRow.cloneNode(true);
          repaintedAgain.querySelector('#stream-text').firstChild.nodeValue = 'Hello world again and more';
          repaintedAgain.querySelector('[data-testid="assistant-message"]').dataset.revealLength = String('Hello world again and more'.length);
          replacementStreamRow.replaceWith(repaintedAgain);
          await wait(30);
          const repaintCover = document.querySelector('[data-cp-stream-reveal]');
          checks.consecutiveRendererRepaintsStayCoverFree = !repaintCover;
          repaintCover?.remove();
          await wait(100);
          const streamContent = document.querySelector('[data-testid="agent-chat-content"]');
          const streamTimeline = document.querySelector('[data-testid="agent-chat-timeline"]');
          const heightBeforeChunk = streamChat.scrollHeight;
          const grownText = 'Hello world ' + 'more text '.repeat(8);
          streamChat.querySelector('[data-testid="assistant-message"]').dataset.revealLength = String(grownText.length);
          document.getElementById('stream-text').firstChild.nodeValue = grownText;
          requestAnimationFrame(() => { streamChat.scrollTop = streamChat.scrollHeight; });
          await wait(30);
          const riseAnimations = animationsOf(streamContent);
          const riseAnimation = riseAnimations.find((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).startsWith('translateY(')));
          const riseFrames = riseAnimation?.effect?.getKeyframes() ?? [];
          checks.streamingContentRises = streamChat.scrollHeight > heightBeforeChunk && riseFrames.some((frame) => {
            const transform = String(frame.transform);
            return transform.startsWith('translateY(') && !transform.startsWith('translateY(-') && transform !== 'translateY(0px)';
          });
          const riseDuration = Number(riseAnimation?.effect?.getTiming().duration ?? 0);
          const riseStart = Math.abs(Number.parseFloat(String(riseFrames[0]?.transform).slice('translateY('.length)));
          const riseAt160 = riseFrames.reduce((nearest, frame) => Math.abs(Number(frame.computedOffset) - 160 / riseDuration) < Math.abs(Number(nearest?.computedOffset ?? 0) - 160 / riseDuration) ? frame : nearest, null);
          const riseDistanceAt160 = Math.abs(Number.parseFloat(String(riseAt160?.transform).slice('translateY('.length)));
          checks.streamingContentRiseKeepsVisibleTravel = riseStart > 0 && riseDistanceAt160 / riseStart >= 0.32;
          streamChat.style.width = '320px';
          await wait(30);
          checks.widthReflowCancelsStreamRise = !animationsOf(streamContent).some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          streamChat.style.width = '220px';
          await wait(450);
          const enteringRow = document.createElement('div');
          enteringRow.dataset.historyRowId = 'new-user-row';
          enteringRow.innerHTML = '<div data-testid="user-message">A new prompt</div>';
          streamTimeline.appendChild(enteringRow);
          await wait(30);
          const entryFrames = enteringRow.getAnimations().flatMap((animation) => animation.effect?.getKeyframes() ?? []);
          checks.messageEntryEases = entryFrames.some((frame) => String(frame.transform).includes('translateY'));
          checks.messageEntryGrowsFromBottomRight = enteringRow.style.transformOrigin === '100% 100%';
          checks.messageEntrySettlesWithTinyBounce = entryFrames.some((frame) => String(frame.transform).includes('translateY(-1.5px)'));
          checks.messageEntryEasesChatHeight = animationsOf(streamContent).some((animation) => animation.effect?.getKeyframes().some((frame) => {
            const transform = String(frame.transform);
            return transform.startsWith('translateY(') && Number.parseFloat(transform.slice('translateY('.length)) > 0;
          }));
          const workingHost = streamChat.querySelector('[data-testid="agent-chat-content"]').lastElementChild;
          workingHost.innerHTML = '<div data-testid="turn-working-indicator">Working</div>';
          await wait(30);
          streamChat.scrollTop = streamChat.scrollHeight;
          streamChat.dispatchEvent(new Event('scroll'));
          const delayedAssistantRow = document.createElement('div');
          delayedAssistantRow.dataset.historyRowId = 'delayed-assistant-row';
          delayedAssistantRow.style = 'width:0;height:0;overflow:hidden';
          delayedAssistantRow.innerHTML = '<div data-testid="assistant-message" data-reveal-length="0"><div class="enrm-text"><p><span></span></p></div></div>';
          streamTimeline.appendChild(delayedAssistantRow);
          await wait(30);
          const delayedAssistant = delayedAssistantRow.querySelector('[data-testid="assistant-message"]');
          delayedAssistant.dataset.revealLength = '11';
          delayedAssistantRow.querySelector('span').textContent = 'First reply';
          delayedAssistantRow.removeAttribute('style');
          await wait(30);
          checks.delayedAssistantUsesTokenMotionOnly = delayedAssistantRow.getAnimations().length === 0;
          document.getElementById('stream-text').firstChild.nodeValue = 'Hello world!';
          await wait(30);
          checks.completedTextStaysStill = !document.querySelector('[data-cp-stream-reveal]');
          const hydrationChat = document.createElement('div');
          hydrationChat.dataset.testid = 'agent-chat-scroll';
          hydrationChat.style = 'width:220px;height:120px;overflow:auto';
          hydrationChat.innerHTML = '<div data-testid="agent-chat-content"><div data-testid="agent-chat-timeline"></div></div>';
          document.body.appendChild(hydrationChat);
          await wait(30);
          const hydratedRow = document.createElement('div');
          hydratedRow.dataset.historyRowId = 'hydrated-user-row';
          hydratedRow.innerHTML = '<div data-testid="user-message">Existing prompt</div>';
          const hydrationTimeline = hydrationChat.querySelector('[data-testid="agent-chat-timeline"]');
          hydrationTimeline.appendChild(hydratedRow);
          await wait(30);
          checks.hydrationDoesNotAnimate = !hydratedRow.getAnimations().some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          const promptAfterHydration = document.createElement('div');
          promptAfterHydration.dataset.historyRowId = 'prompt-after-hydration';
          promptAfterHydration.innerHTML = '<div data-testid="user-message">A new prompt</div>';
          hydrationTimeline.appendChild(promptAfterHydration);
          await wait(30);
          checks.newPromptAfterHydrationEases = promptAfterHydration.getAnimations().some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          hydrationChat.remove();
          motionEnabled = false;
          document.documentElement.dataset.cpRtMotion = 'off';
          syncMotion();
          await wait(30);
          const stillRow = document.createElement('div');
          stillRow.dataset.historyRowId = 'motion-disabled-row';
          stillRow.innerHTML = '<div data-testid="user-message">No entrance</div>';
          streamTimeline.appendChild(stillRow);
          const stillText = streamChat.querySelector('[data-testid="assistant-message"]');
          stillText.dataset.revealLength = String(Number(stillText.dataset.revealLength) + 5);
          stillText.querySelector('.enrm-text').append(' still');
          await wait(30);
          checks.motionSwitchStopsBranchAnimations = !stillRow.getAnimations().length
            && !animationsOf(streamContent).length;
          motionEnabled = true;
          delete document.documentElement.dataset.cpRtMotion;
          syncMotion();
          await wait(30);
          workingHost.innerHTML = '';
          await wait(400);
          animationsOf(streamContent).forEach((animation) => animation.cancel());
          streamChat.scrollTop = streamChat.scrollHeight;
          streamChat.dispatchEvent(new Event('scroll'));
          await wait(30);
          streamTimeline.innerHTML = '<div style="height:420px;flex-shrink:0"></div><div data-history-row-id="restored-assistant-row"><div data-testid="assistant-message"><div class="enrm-text"><p>Previously streamed reply in another tab</p></div></div></div>';
          requestAnimationFrame(() => { streamChat.scrollTop = streamChat.scrollHeight; });
          await wait(30);
          const restoredRow = streamTimeline.querySelector('[data-history-row-id="restored-assistant-row"]');
          const tabSwitchTimelineMotion = animationsOf(streamContent).some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          const tabSwitchRowMotion = restoredRow.getAnimations().length > 0;
          checks.tabSwitchHistoryStaysStill = !tabSwitchRowMotion && !tabSwitchTimelineMotion;
          document.getElementById('stream-chat').remove();
          first.remove(); await wait(); checks.detachedReleased = released === 10;
          const card = document.querySelector('[data-testid="context-window-details"]');
          const usage = card.lastElementChild;
          usage.style.height = '40px'; usage.appendChild(document.createElement('span')); await wait();
          const heights = JSON.parse(localStorage.getItem('chat-polish:context-card-heights'));
          checks.heightShrinks = heights[''] < 180 && !card.style.minHeight;
          usage.remove(); card.appendChild(document.createElement('span')); await wait();
          checks.placeholder = !!card.style.minHeight;
          card.appendChild(usage); await wait(); checks.placeholderReleased = !card.style.minHeight;
          let fullScans = 0; let markdownScans = 0;
          const queryDocument = Document.prototype.querySelectorAll;
          Document.prototype.querySelectorAll = function(selector) { if (selector === '*') fullScans++; return queryDocument.call(this, selector); };
          const queryElement = Element.prototype.querySelectorAll;
          Element.prototype.querySelectorAll = function(selector) { if (this === document.documentElement && selector.includes('data-paseo-markdown')) markdownScans++; return queryElement.call(this, selector); };
          document.getElementById('marker').firstChild.nodeValue = '[!NOTE]';
          document.querySelector('[data-testid="settings-detail-pane"]').appendChild(document.createElement('div'));
          await wait(300);
          checks.calloutUpdated = document.getElementById('marker').parentElement.dataset.cpCallout === 'note';
          checks.noGlobalScans = fullScans === 0 && markdownScans === 0;
          checks.observerSettles &&= !capped;
          smooth(); clamp(); restyle();
          const unstyle = web.stylePluginViews();
          const streamToken = document.createElement('span');
          streamToken.dataset.cpStreamToken = 'true';
          streamToken.textContent = 'new text';
          document.body.appendChild(streamToken);
          await wait(30);
          const tokenAnimations = streamToken.getAnimations();
          const tokenFrames = tokenAnimations.flatMap((animation) => animation.effect?.getKeyframes() ?? []);
          checks.streamTokenAddsThemeIndependentBlur = tokenFrames.some((frame) => Number(frame.opacity) === 0 && String(frame.filter).includes('blur(2px)'))
            && tokenFrames.every((frame) => frame.color === undefined);
          checks.streamTokenGivesChatMotionAHeadStart = tokenAnimations.some((animation) => animation.effect?.getTiming().delay === 36);
          streamToken.remove();
          const arrivingImage = document.createElement('div');
          arrivingImage.dataset.cpImageArrival = '';
          arrivingImage.textContent = 'image';
          document.body.appendChild(arrivingImage);
          await wait(30);
          checks.imageArrivalEases = arrivingImage.getAnimations().some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY') && Number(frame.opacity) < 1));
          arrivingImage.remove();
          const restoredDisclosure = document.createElement('div');
          restoredDisclosure.dataset.cpExpand = 'open';
          restoredDisclosure.dataset.cpExpandRestored = '';
          restoredDisclosure.innerHTML = '<div style="min-height:0;overflow:hidden"><div style="height:48px">Restored output</div></div>';
          document.body.appendChild(restoredDisclosure);
          await wait(30);
          checks.restoredDisclosureDoesNotReplayEntrance = restoredDisclosure.getAnimations().length === 0;
          restoredDisclosure.remove();
          checks.accordionCloses = true; checks.accordionReverses = true;
          for (const width of [320, 1000]) {
            const fixture = document.createElement('div'); fixture.style.width = width + 'px';
            fixture.innerHTML = '<div data-cp-expand="open" style="display:flex;flex-direction:column"><div style="display:flex;flex-direction:column;min-height:0;overflow:hidden"><div style="display:flex;margin-top:6px;margin-bottom:12px;height:100px;flex-shrink:0">Output</div></div></div><div>Next tool</div>';
            document.body.appendChild(fixture);
            const box = fixture.firstElementChild, next = fixture.lastElementChild;
            const height = () => box.getBoundingClientRect().height;
            height(); box.getAnimations().forEach((animation) => animation.finish());
            const full = height(); box.dataset.cpExpand = 'closed'; height();
            const animations = box.getAnimations(); animations.forEach((animation) => animation.pause());
            animations.forEach((animation) => { animation.currentTime = 50; });
            const middle = height();
            checks.accordionCloses &&= full === 118 && middle > 0 && middle < full && Math.abs(next.getBoundingClientRect().top - box.getBoundingClientRect().top - middle) < 1;
            animations.forEach((animation) => animation.finish());
            checks.accordionCloses &&= height() === 0;
            box.dataset.cpExpand = 'open'; height();
            const opening = box.getAnimations(); opening.forEach((animation) => { animation.pause(); animation.currentTime = 25; });
            const partial = height(); box.dataset.cpExpand = 'closed';
            checks.accordionReverses &&= partial > 0 && partial < full && Math.abs(height() - partial) < 1;
            box.getAnimations().forEach((animation) => animation.finish());
            checks.accordionReverses &&= height() === 0;
            fixture.remove();
          }
          const smoothExpansion = web.smoothStreamingText();
          const chat = document.createElement('div');
          chat.dataset.testid = 'agent-chat-scroll';
          chat.style = 'width:600px;height:400px;overflow:auto;overflow-anchor:auto';
          chat.innerHTML = '<div data-testid="agent-chat-content" style="display:flex;flex-direction:column;padding:16px"><div data-testid="agent-chat-timeline"><div style="height:700px;flex-shrink:0;overflow-anchor:none"></div><div data-history-row-id="tool-row" style="flex-shrink:0"><button>Ran command</button><div data-cp-expand="closed"><div style="min-height:0;overflow:hidden"><div style="height:250px;margin:6px 0 12px">Output</div></div></div></div><div data-history-row-id="merged-run-row" style="flex-shrink:0"><div id="merged-run" style="height:24px"><span data-cp-running-label="">Running command</span></div></div><div data-history-row-id="assistant-turn" style="flex-shrink:0"><div data-testid="assistant-message" style="height:36px">Finished reply</div><div id="turn-extras"></div></div></div><div id="completion-host"><div data-testid="turn-working-indicator">Working</div></div></div>';
          document.body.appendChild(chat);
          const content = chat.firstElementChild, expanding = chat.querySelector('[data-cp-expand]');
          chat.scrollTop = chat.scrollHeight; await wait();
          chat.dispatchEvent(new WheelEvent('wheel', { deltaY: -80, bubbles: true }));
          chat.scrollTop -= 80;
          chat.dispatchEvent(new Event('scroll', { bubbles: false }));
          await wait(30);
          checks.manualScrollDoesNotBecomeStreamRise = !animationsOf(content).some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          animationsOf(content).forEach((animation) => animation.cancel());
          chat.scrollTop = chat.scrollHeight; await wait();
          await wait(250);
          const mountedTool = chat.querySelector('[data-history-row-id="tool-row"]');
          const mountedToolLine = mountedTool.querySelector('button');
          const mountedToolLineBeforeDetails = mountedToolLine.getBoundingClientRect().top;
          const mountedDetails = document.createElement('div');
          mountedDetails.style.height = '48px';
          mountedDetails.textContent = 'Tool result metadata';
          mountedTool.appendChild(mountedDetails);
          requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
          await wait(30);
          const mountedToolLineJump = mountedToolLineBeforeDetails - mountedToolLine.getBoundingClientRect().top;
          checks.detailsInMountedToolEaseLinesAbove = mountedToolLineJump >= 0 && mountedToolLineJump < 20
            && animationsOf(content).some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          await wait(800);
          chat.scrollTop = chat.scrollHeight;
          await wait(30);
          const toolTimeline = chat.querySelector('[data-testid="agent-chat-timeline"]');
          const arrivingTool = document.createElement('div');
          arrivingTool.dataset.historyRowId = 'arriving-tool-row';
          arrivingTool.innerHTML = '<div data-testid="tool-call-badge"><button><span data-cp-part="row-label">Ran another command</span></button><div style="height:48px">New tool details</div></div>';
          toolTimeline.appendChild(arrivingTool);
          requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
          await wait(30);
          const toolRiseAnimation = animationsOf(content).find((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).startsWith('translateY(')));
          const toolRiseFrames = toolRiseAnimation?.effect?.getKeyframes() ?? [];
          const toolViewportRise = Math.abs(Number.parseFloat(String(toolRiseFrames[0]?.transform).slice('translateY('.length)));
          const toolSummaryAnimations = arrivingTool.querySelector('[data-cp-part="row-label"]').getAnimations();
          const toolSummaryFrames = toolSummaryAnimations.flatMap((animation) => animation.effect?.getKeyframes() ?? []);
          checks.toolSummaryViewportGetsLead = toolViewportRise > arrivingTool.getBoundingClientRect().height + 3;
          checks.toolSummaryLineRisesAfterViewport = toolSummaryAnimations.some((animation) => Number(animation.effect?.getTiming().delay) >= 16)
            && toolSummaryFrames.some((frame) => Number(frame.opacity) < 1 && String(frame.transform).includes('translateY(4px)'));
          animationsOf(content).forEach((animation) => animation.cancel());
          const completionHost = document.getElementById('completion-host');
          completionHost.innerHTML = '<div id="completion-footer"><div><button data-testid="assistant-fork-menu-trigger" aria-label="Fork"></button></div><span>Worked for 8m 40s</span></div>';
          requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
          await wait(30);
          const hasRise = (surface) => surface.getAnimations().some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          checks.completedTurnDetailsEaseChatWithoutMovingFooter = hasRise(toolTimeline) && !hasRise(completionHost);
          animationsOf(content).forEach((animation) => animation.cancel());
          await wait(450);
          chat.scrollTop = chat.scrollHeight;
          chat.dispatchEvent(new Event('scroll'));
          const turnExtras = document.getElementById('turn-extras');
          turnExtras.innerHTML = '<div data-cp-turn-recap="" style="height:26px">2 files +14 −3 · 4 commands</div>';
          requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
          await wait(30);
          const recapSummary = turnExtras.querySelector('[data-cp-turn-recap]');
          const recapFrames = recapSummary.getAnimations().flatMap((animation) => animation.effect?.getKeyframes() ?? []);
          checks.turnRecapEasesIntoChat = recapFrames.some((frame) => Number(frame.opacity) < 1 && String(frame.transform).includes('translateY(4px)'))
            && animationsOf(content).some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).startsWith('translateY(')));
          animationsOf(content).forEach((animation) => animation.cancel());
          await wait(450);
          chat.scrollTop = chat.scrollHeight;
          chat.dispatchEvent(new Event('scroll'));
          const mergedRun = document.getElementById('merged-run');
          const runHeightBefore = chat.scrollHeight;
          mergedRun.setAttribute('data-cp-run-summary', '');
          mergedRun.firstElementChild.removeAttribute('data-cp-running-label');
          mergedRun.firstElementChild.textContent = 'Thought twice and ran four commands';
          mergedRun.style.height = '54px';
          requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
          await wait(30);
          const runHeightDelta = chat.scrollHeight - runHeightBefore;
          const runRiseAnimation = toolTimeline.getAnimations().find((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).startsWith('translateY(')));
          const runRiseFrame = runRiseAnimation?.effect?.getKeyframes()[0];
          const runViewportRise = Math.abs(Number.parseFloat(String(runRiseFrame?.transform).slice('translateY('.length)));
          checks.completedToolSummaryGetsViewportLead = runHeightDelta > 0 && runViewportRise > runHeightDelta + 3
            && mergedRun.getAnimations().length === 0;
          // Paseo 0.11.4 follows content resizing in the next animation frame.
          let hostFollowing = true;
          const hostFollow = new ResizeObserver(() => requestAnimationFrame(() => {
            if (hostFollowing) chat.scrollTop = chat.scrollHeight;
          }));
          hostFollow.observe(content); await wait();
          chat.querySelector('button').focus({ preventScroll: true });
          web.followExpansionAtBottom();
          const gaps = [];
          const beforePaint = new ResizeObserver(() => gaps.push(chat.scrollHeight - chat.clientHeight - chat.scrollTop));
          beforePaint.observe(content);
          expanding.dataset.cpExpand = 'open'; expanding.getBoundingClientRect();
          const reveal = expanding.getAnimations(); reveal.forEach((animation) => animation.pause());
          let footerCaughtByExpansion = false;
          let disclosureHasIntermediateMotion = false;
          for (const time of [0, 20, 50, 100]) {
            reveal.forEach((animation) => { animation.currentTime = time; });
            const expansionHeight = expanding.getBoundingClientRect().height;
            disclosureHasIntermediateMotion ||= time > 0 && expansionHeight > 0 && expansionHeight < 268;
            await wait(30);
            footerCaughtByExpansion ||= animationsOf(content).some((animation) => animation.effect?.getKeyframes().some((frame) => String(frame.transform).includes('translateY')));
          }
          checks.expansionStaysAtBottom = gaps.length > 0 && gaps.every((gap) => Math.abs(gap) <= 1);
          checks.footerIndependentOfToolExpansion = !footerCaughtByExpansion;
          checks.disclosureKeepsItsOwnMotion = reveal.length > 0 && disclosureHasIntermediateMotion;
          hostFollowing = false;
          beforePaint.disconnect(); hostFollow.disconnect();
          reveal.forEach((animation) => animation.finish());
          chat.dispatchEvent(new WheelEvent('wheel', { deltaY: -80, bubbles: true }));
          chat.style.overflowAnchor = 'none'; chat.scrollTop -= 80;
          const readingTop = chat.scrollTop, output = expanding.firstElementChild.firstElementChild;
          output.style.height = '300px'; await wait(30);
          checks.userScrollCancelsFollowing = Math.abs(chat.scrollTop - readingTop) <= 1;
          web.followExpansionAtBottom(); output.style.height = '350px'; await wait(30);
          checks.detachedReadingPreserved = Math.abs(chat.scrollTop - readingTop) <= 1;
          chat.scrollTop = chat.scrollHeight;
          const detachedBottom = chat.scrollTop;
          web.followExpansionAtBottom(); output.style.height = '400px'; await wait(30);
          checks.disabledFollowingPreserved = Math.abs(chat.scrollTop - detachedBottom) <= 1;
          smoothExpansion();
          chat.remove();
          const diff = document.createElement('div');
          diff.dataset.cpNowrap = '';
          diff.style = 'width:300px;max-height:100px;overflow-x:hidden;overflow-y:auto;display:flex;flex-direction:column;font:12px monospace;line-height:18px';
          const lines = document.createElement('div'); lines.style = 'display:flex;flex-direction:column';
          for (let i = 0; i < 12; i++) {
            const row = document.createElement('div'); row.style = 'display:flex;gap:12px;flex-shrink:0';
            const gutter = document.createElement('span'); gutter.textContent = '+ ' + String(99 + i).padStart(3, '\\u2007'); gutter.style.flexShrink = '0';
            const code = document.createElement('span'); code.dataset.pmono = ''; code.style = 'flex-grow:1;flex-shrink:0;white-space:pre-wrap;overflow-wrap:break-word'; code.textContent = '  const value = ' + 'longFunctionName(argument); '.repeat(12);
            row.append(gutter, code); lines.appendChild(row);
          }
          diff.appendChild(lines); document.body.appendChild(diff);
          const firstCode = lines.firstElementChild.lastElementChild;
          diff.scrollLeft = 80; diff.scrollTop = 36;
          checks.diffNoWrapScrollsBothAxes = firstCode.getBoundingClientRect().height === 18 && diff.scrollLeft === 80 && diff.scrollTop === 36;
          diff.removeAttribute('data-cp-nowrap');
          for (const row of lines.children) row.lastElementChild.style = 'flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:break-word';
          checks.diffWrapRestoresWrapping = firstCode.getBoundingClientRect().height > 18 && diff.scrollWidth <= diff.clientWidth + 1;
          diff.remove();
          unstyle();
          document.title = JSON.stringify({ checks, errors });
        })().catch((error) => { document.title = JSON.stringify({ error: error.stack, checks }); }).finally(() => fetch('/done'));
      </script></body></html>`;
    // Hold page load open while real animation frames and ResizeObserver callbacks run.
    let held;
    server = createServer((request, response) => {
      if (request.url === "/hold") { held = response; return; }
      if (request.url === "/done") { held?.end(); response.end(); return; }
      if (request.url === "/bundle.js") { response.end(bundle); return; }
      response.setHeader("Content-Type", "text/html"); response.end(html);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const result = await promisify(execFile)(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", `--user-data-dir=${join(temp, "chrome")}`, "--dump-dom", `http://127.0.0.1:${server.address().port}`], { encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
    const title = /<title>([\s\S]*?)<\/title>/.exec(result.stdout)?.[1];
    assert.notEqual(title, "pending", "browser test did not finish");
    const report = JSON.parse(title.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"));
    assert.equal(report.error, undefined, report.error);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(Object.entries(report.checks).filter(([, passed]) => !passed).map(([check]) => check), []);
    assert.equal(Object.keys(report.checks).length, 47);
  } finally {
    server?.closeAllConnections(); server?.close();
    rmSync(temp, { recursive: true, force: true });
  }
});
