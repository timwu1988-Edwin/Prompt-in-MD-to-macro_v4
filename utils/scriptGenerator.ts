/**
 * Generates the JavaScript code to be injected into the NotebookLM console.
 * This script handles the DOM manipulation, timing logic, and response scraping.
 */
export const generateMacroScript = (prompts: string[], intervalMinutes: number = 1.5): string => {
  const intervalMs = intervalMinutes * 60 * 1000;
  const serializedPrompts = JSON.stringify(prompts);

  return `
// ==========================================
// AutoMonitor: NotebookLM Automation Script (v3.5 - Jump to Step)
// ==========================================
(async function() {
  // --- STATE & CLEANUP ---
  if (window.AUTO_MONITOR_UI) {
     try { document.body.removeChild(window.AUTO_MONITOR_UI); } catch(e) {}
  }
  
  window.AUTO_MONITOR = { 
    stopped: false,
    paused: false,     // New: Pause state
    skipWait: false,   // Skip only the timer
    skipStep: false,   // New: Skip entire current step
    jumpToStep: undefined, // New: Jump to a specific step
    transcript: [] 
  };
  
  // --- UI CREATION (Strict DOM API) ---
  const createControlPanel = (totalSteps) => {
    const div = document.createElement('div');
    div.id = 'auto-monitor-panel';
    div.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; background: #0f172a; padding: 16px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif; color: white; display: flex; flex-direction: column; gap: 10px; min-width: 280px; border: 1px solid #334155;';
    
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    
    const title = document.createElement('div');
    title.textContent = '🤖 AutoMonitor v3.5'; 
    title.style.fontWeight = 'bold';
    title.style.fontSize = '14px';
    title.style.color = '#38bdf8';
    
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.padding = '4px';
    closeBtn.onclick = () => window.stopAutoMonitor();
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const status = document.createElement('div');
    status.id = 'am-status';
    status.textContent = 'Initializing...';
    status.style.fontSize = '12px';
    status.style.color = '#e2e8f0';
    status.style.fontWeight = '500';

    const timer = document.createElement('div');
    timer.id = 'am-timer';
    timer.textContent = '';
    timer.style.fontSize = '11px';
    timer.style.color = '#94a3b8';
    timer.style.fontFamily = 'monospace';
    timer.style.minHeight = '15px';

    // Buttons Container (Grid Layout)
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'grid';
    btnContainer.style.gridTemplateColumns = '1fr 1fr';
    btnContainer.style.gap = '8px';
    btnContainer.style.marginBottom = '8px';

    // 1. Pause/Resume Button
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'am-btn-pause';
    pauseBtn.textContent = '⏸ Pause';
    pauseBtn.style.cssText = 'background: #d97706; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 11px; transition: background 0.2s;';
    pauseBtn.onclick = () => {
        window.AUTO_MONITOR.paused = !window.AUTO_MONITOR.paused;
        const isPaused = window.AUTO_MONITOR.paused;
        pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
        pauseBtn.style.background = isPaused ? '#16a34a' : '#d97706';
    };

    // 2. Next Prompt Button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '⏭ Next Prompt';
    nextBtn.style.cssText = 'background: #4f46e5; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 11px; transition: background 0.2s;';
    nextBtn.onclick = () => {
        if (confirm("Skip current prompt and jump to the next one?")) {
            window.AUTO_MONITOR.skipStep = true;
            window.AUTO_MONITOR.skipWait = true; // Break wait loop if active
            // If paused, unpause momentarily to allow loop to proceed
            if (window.AUTO_MONITOR.paused) {
                 window.AUTO_MONITOR.paused = false; 
                 document.getElementById('am-btn-pause').textContent = '⏸ Pause';
                 document.getElementById('am-btn-pause').style.background = '#d97706';
            }
        }
    };

    // 3. Skip Wait Button
    const skipWaitBtn = document.createElement('button');
    skipWaitBtn.textContent = '⏩ Skip Wait';
    skipWaitBtn.style.cssText = 'background: #334155; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 11px; transition: background 0.2s;';
    skipWaitBtn.onclick = () => { window.AUTO_MONITOR.skipWait = true; };

    // 4. Stop Button
    const stopBtn = document.createElement('button');
    stopBtn.textContent = '⏹ Stop & Save';
    stopBtn.style.cssText = 'background: #ef4444; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 11px; transition: background 0.2s;';
    stopBtn.onclick = () => window.stopAutoMonitor();

    btnContainer.appendChild(pauseBtn);
    btnContainer.appendChild(nextBtn);
    btnContainer.appendChild(skipWaitBtn);
    btnContainer.appendChild(stopBtn);

    // Jump to Step Container
    const jumpContainer = document.createElement('div');
    jumpContainer.style.display = 'flex';
    jumpContainer.style.gap = '8px';
    jumpContainer.style.alignItems = 'center';
    jumpContainer.style.padding = '8px';
    jumpContainer.style.background = '#1e293b';
    jumpContainer.style.borderRadius = '6px';
    jumpContainer.style.border = '1px solid #334155';

    const jumpLabel = document.createElement('span');
    jumpLabel.textContent = 'Jump to Step:';
    jumpLabel.style.fontSize = '11px';
    jumpLabel.style.color = '#94a3b8';
    jumpLabel.style.fontWeight = '500';

    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = '1';
    jumpInput.max = totalSteps.toString();
    jumpInput.placeholder = '1-' + totalSteps;
    jumpInput.style.cssText = 'background: #0f172a; color: white; border: 1px solid #475569; border-radius: 4px; padding: 4px 6px; width: 60px; font-size: 11px; outline: none;';
    
    const jumpBtn = document.createElement('button');
    jumpBtn.textContent = 'Go';
    jumpBtn.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; transition: background 0.2s;';
    jumpBtn.onmouseover = () => jumpBtn.style.background = '#2563eb';
    jumpBtn.onmouseout = () => jumpBtn.style.background = '#3b82f6';
    jumpBtn.onclick = () => {
        const targetStep = parseInt(jumpInput.value, 10);
        if (!isNaN(targetStep) && targetStep >= 1 && targetStep <= totalSteps) {
            window.AUTO_MONITOR.jumpToStep = targetStep - 1; // 0-indexed
            window.AUTO_MONITOR.skipStep = true;
            window.AUTO_MONITOR.skipWait = true;
            if (window.AUTO_MONITOR.paused) {
                 window.AUTO_MONITOR.paused = false; 
                 document.getElementById('am-btn-pause').textContent = '⏸ Pause';
                 document.getElementById('am-btn-pause').style.background = '#d97706';
            }
            jumpInput.value = '';
        } else {
            alert('Invalid step number. Must be between 1 and ' + totalSteps);
        }
    };

    jumpContainer.appendChild(jumpLabel);
    jumpContainer.appendChild(jumpInput);
    jumpContainer.appendChild(jumpBtn);

    div.appendChild(header);
    div.appendChild(status);
    div.appendChild(timer);
    div.appendChild(btnContainer);
    div.appendChild(jumpContainer);
    document.body.appendChild(div);
    window.AUTO_MONITOR_UI = div;
  };

  const updateStatus = (text) => {
    const el = document.getElementById('am-status');
    if (el) el.textContent = text;
  };

  const updateTimer = (text) => {
    const el = document.getElementById('am-timer');
    if (el) el.textContent = text;
  };

  window.stopAutoMonitor = function() {
    if (window.AUTO_MONITOR.stopped) return;
    window.AUTO_MONITOR.stopped = true;
    updateStatus('Stopping... Saving...');
    console.warn("🛑 Stop requested by user.");
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper to handle Pause State
  const checkPaused = async (currentStep, totalSteps) => {
      while (window.AUTO_MONITOR.paused) {
          if (window.AUTO_MONITOR.stopped) return;
          if (window.AUTO_MONITOR.skipStep) return; // Allow skipping while paused
          updateStatus(\`⏸ Paused: Step \${currentStep}/\${totalSteps}\`);
          await sleep(200);
      }
  };

  const waitWithCountdown = async (durationMs, currentStep, totalSteps) => {
    let remaining = durationMs;
    window.AUTO_MONITOR.skipWait = false;

    while (remaining > 0) {
      if (window.AUTO_MONITOR.stopped) return false;
      
      // Handle Skip Step request
      if (window.AUTO_MONITOR.skipStep) {
          console.log("⏭ Skipping step requested.");
          return true;
      }
      
      // Handle Skip Wait request
      if (window.AUTO_MONITOR.skipWait) {
          console.log("⏩ Wait skipped by user.");
          return true;
      }

      // Handle Pause
      if (window.AUTO_MONITOR.paused) {
          updateStatus(\`⏸ Paused: Step \${currentStep}/\${totalSteps}\`);
          await sleep(500);
          continue; // Do not decrement timer while paused
      }

      updateStatus(\`Step \${currentStep}/\${totalSteps}: Waiting for answer...\`);
      updateTimer(\`Wait remaining: \${Math.ceil(remaining / 1000)}s\`);
      
      if (remaining % 5000 === 0) window.scrollTo(0, document.body.scrollHeight);
      await sleep(1000);
      remaining -= 1000;
    }
    updateTimer("");
    return true;
  };

  const setNativeValue = (element, value) => {
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          const descriptor = Object.getOwnPropertyDescriptor(element, 'value');
          let valueSetter = descriptor ? descriptor.set : null;
          if (!valueSetter) {
             const prototype = Object.getPrototypeOf(element);
             const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
             valueSetter = prototypeDescriptor ? prototypeDescriptor.set : null;
          }
          if (valueSetter) {
              valueSetter.call(element, value);
          } else {
              element.value = value;
          }
      } else {
          element.textContent = value;
      }
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      if (element.getAttribute('contenteditable') === 'true') {
          element.dispatchEvent(new Event('focus', { bubbles: true }));
      }
  };

  const findChatInput = () => {
    const candidates = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"], input[type="text"]'));
    const valid = candidates.filter(el => {
       const rect = el.getBoundingClientRect();
       return rect.width > 50 && rect.height > 20 && rect.top > 0;
    });
    valid.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return valid[0];
  };

  const findSendButton = (inputEl) => {
     if (!inputEl) return null;
     let parent = inputEl.parentElement;
     let attempts = 0;
     while (parent && attempts < 6) {
        const btns = Array.from(parent.querySelectorAll('button'));
        const send = btns.find(b => {
           const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
           const hasIcon = b.querySelector('svg');
           return !b.disabled && (label.includes('send') || label.includes('submit') || hasIcon);
        });
        if (send) return send;
        parent = parent.parentElement;
        attempts++;
     }
     return null;
  };

  // --- ANSWER CAPTURE: MULTI-STRATEGY ---
  const captureAnswerRobust = (promptText, preStepTextLength) => {
      const mainEl = document.querySelector('main') || document.body;
      const fullText = mainEl.innerText;
      const cleanForMatching = (str) => str.replace(/[*_#\`~>]/g, '').trim();

      const searchStartIndex = Math.max(0, preStepTextLength - 200);
      const newTextSegment = fullText.substring(searchStartIndex);
      const cleanNewText = cleanForMatching(newTextSegment);

      // Strategy 1: Last Line
      const promptLines = promptText.split('\\n').filter(l => l.trim().length > 5);
      const lastLine = promptLines.length > 0 ? promptLines[promptLines.length - 1] : promptText.substring(promptText.length - 20);
      const cleanLastLine = cleanForMatching(lastLine);

      const indexByLastLine = cleanNewText.lastIndexOf(cleanLastLine);
      if (indexByLastLine !== -1) {
          const rawIndex = newTextSegment.lastIndexOf(lastLine.trim());
          if (rawIndex !== -1) {
              return newTextSegment.substring(rawIndex + lastLine.trim().length).trim();
          }
          return newTextSegment.substring(newTextSegment.length / 2); 
      }

      // Strategy 2: First Line
      const firstLine = promptLines[0] || promptText.substring(0, 20);
      const cleanFirstLine = cleanForMatching(firstLine);
      const indexByFirstLine = cleanNewText.lastIndexOf(cleanFirstLine);
      
      if (indexByFirstLine !== -1) {
          const rawIndexFirst = newTextSegment.lastIndexOf(firstLine.trim());
          if (rawIndexFirst !== -1) {
              return newTextSegment.substring(rawIndexFirst + firstLine.trim().length).trim();
          }
      }

      // Strategy 3: Snapshot Diff
      if (newTextSegment.length > promptText.length) {
          return newTextSegment;
      }
      return newTextSegment;
  };

  const saveTranscript = () => {
    if (window.AUTO_MONITOR.transcript.length === 0) {
      alert("No transcripts captured to save.");
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let content = "# NotebookLM Answers Export\\n\\n";
    content += \`Date: \${new Date().toLocaleString()}\` + "\\n";
    content += "---" + "\\n\\n";
    
    window.AUTO_MONITOR.transcript.forEach((item, idx) => {
      content += \`### Part \${idx + 1}\` + "\\n";
      content += \`**Prompt:** \${item.prompt}\` + "\\n\\n";
      content += \`**Answer:**\` + "\\n" + item.response + "\\n\\n";
      content += "---" + "\\n\\n";
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = \`notebooklm_export_\${timestamp}.md\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log("💾 Transcript saved.");
  };

  // --- MAIN LOGIC ---

  const prompts = ${serializedPrompts};
  const INTERVAL_MS = ${intervalMs};
  const total = prompts.length;

  console.clear();
  createControlPanel(total);
  console.log("🤖 AutoMonitor v3.5 (Jump to Step) Started");

  let currentTextLength = (document.querySelector('main') || document.body).innerText.length;

  for (let i = 0; i < prompts.length; i++) {
     if (window.AUTO_MONITOR.stopped) break;
     
     if (window.AUTO_MONITOR.jumpToStep !== undefined) {
         i = window.AUTO_MONITOR.jumpToStep;
         window.AUTO_MONITOR.jumpToStep = undefined;
         window.AUTO_MONITOR.skipStep = false;
         window.AUTO_MONITOR.skipWait = false;
     }

     // 1. Check Paused before starting step
     await checkPaused(i + 1, total);

     // 2. Check Next/Skip Flag (Pre-Input)
     if (window.AUTO_MONITOR.skipStep) {
         window.AUTO_MONITOR.skipStep = false;
         updateStatus(\`Step \${i+1}/\${total}: Skipped by user.\`);
         await sleep(1000);
         continue; // Jump to next loop
     }
     
     const prompt = prompts[i];
     updateStatus(\`Step \${i+1}/\${total}: Inputting...\`);
     
     // Update snapshot
     const mainEl = document.querySelector('main') || document.body;
     const preStepLength = mainEl.innerText.length;
     
     try {
         await sleep(1000);
         
         // Re-check flags before inputting
         await checkPaused(i + 1, total);
         if (window.AUTO_MONITOR.skipStep) {
            window.AUTO_MONITOR.skipStep = false;
            continue; 
         }

         const inputEl = findChatInput();
         if (!inputEl) throw new Error("Input box not found");

         inputEl.focus();
         setNativeValue(inputEl, prompt);
         await sleep(800); 

         const sendBtn = findSendButton(inputEl);
         if (sendBtn) {
             sendBtn.click();
             console.log("Clicked Send Button");
         } else {
             inputEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter' }));
             console.log("Sent via Enter Key");
         }

         updateStatus(\`Step \${i+1}/\${total}: Waiting...\`);
         window.scrollTo(0, document.body.scrollHeight);
         
         const completed = await waitWithCountdown(INTERVAL_MS, i + 1, total);
         
         if (window.AUTO_MONITOR.stopped) break; 
         
         // Handle "Next Prompt" triggered during wait
         if (window.AUTO_MONITOR.skipStep) {
             window.AUTO_MONITOR.skipStep = false;
             updateStatus(\`Step \${i+1}/\${total}: Skipped during wait.\`);
             await sleep(1000);
             continue; // Don't capture, just go next
         }

         updateStatus(\`Step \${i+1}/\${total}: Capturing...\`);
         await sleep(1500); 
         window.scrollTo(0, document.body.scrollHeight); 

         const answer = captureAnswerRobust(prompt, preStepLength);
         const finalAnswer = answer.length < 5 ? "(Content capture failed or answer was empty)" : answer;
         
         window.AUTO_MONITOR.transcript.push({ prompt, response: finalAnswer });
         console.log(\`✅ Step \${i+1} captured\`);

         currentTextLength = (document.querySelector('main') || document.body).innerText.length;

     } catch (e) {
         console.error(e);
         updateStatus(\`Error in Step \${i+1}. Skipping...\`);
         window.AUTO_MONITOR.transcript.push({ prompt, response: \`Error: \${e.message}\` });
         await sleep(2000);
     }
  }

  saveTranscript();
  updateStatus("Done! File downloaded.");
  
  setTimeout(() => {
     if (window.AUTO_MONITOR_UI) document.body.removeChild(window.AUTO_MONITOR_UI);
  }, 10000);

})();
`;
};