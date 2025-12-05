let isAutomating = false;
let lastQuestionHash = null;
let ixlDebug = false;

function waitForElement(selector, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const i = setInterval(() => {
			const el = document.querySelector(selector);
			if (el) {
				clearInterval(i);
				resolve(el);
			} else if (Date.now() - start > timeout) {
				clearInterval(i);
				reject(new Error('Element not found: ' + selector));
			}
		}, 150);
	});
}

function addAutomationButton() {
	const header = document.querySelector('header') || document.body;
	const container = document.createElement('div');
	container.setAttribute('data-ixl-auto-button', '1');
	container.style.position = 'fixed';
	container.style.top = '10px';
	container.style.right = '10px';
	container.style.zIndex = 999999;

	const btn = document.createElement('button');
	btn.textContent = 'Start IXL Auto';
	btn.style.padding = '8px 10px';
	btn.style.background = '#2d7dd2';
	btn.style.color = '#fff';
	btn.style.border = 'none';
	btn.style.borderRadius = '4px';
	btn.style.cursor = 'pointer';

	btn.addEventListener('click', () => {
		if (isAutomating) {
			isAutomating = false;
			btn.textContent = 'Start IXL Auto';
		} else {
			isAutomating = true;
			btn.textContent = 'Stop IXL Auto';
			checkForQuestion();
		}
	});

	container.appendChild(btn);
	document.documentElement.appendChild(container);
	if (ixlDebug) console.log('IXL Auto: button injected');
}

function getQuestionDataFromContainer(container) {
	if (!container) return null;

	const text = container.textContent.trim();
	if (!text) return null;

	// try to find option elements inside the container
	const options = [];

	// common patterns
	const optionSelectors = [
		'label',
		'.option',
		'.choice',
		'.answer',
		'input[type="radio"]',
		'input[type="checkbox"]',
		'button'
	];

	optionSelectors.forEach((sel) => {
		const els = container.querySelectorAll(sel);
		els.forEach((el) => {
			let textVal = '';
			if (el.tagName.toLowerCase() === 'input') {
				const lab = container.querySelector('label[for="' + el.id + '"]');
				if (lab) textVal = lab.textContent.trim();
			} else {
				textVal = el.textContent.trim();
			}
			if (textVal && options.indexOf(textVal) === -1) {
				options.push(textVal);
			}
		});
	});

	return {
		question: text,
		options: options,
		type: options.length > 0 ? 'multiple_choice' : 'text',
	};
}

function hashString(s) {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
	return h;
}

function applyAnswer(answerData) {
	try {
		const container = document.querySelector('div.seecontentpiece');
		if (!container) return;

		const answer = Array.isArray(answerData.answer)
			? answerData.answer[0]
			: answerData.answer;

		if (!answer) return;

		// try to match and click an option
		const optionEls = Array.from(container.querySelectorAll('label, .option, .choice, .answer, button'));

		for (const el of optionEls) {
			const txt = el.textContent.trim();
			if (!txt) continue;

			const normalized = txt.replace(/\s+/g, ' ').trim().toLowerCase().replace(/\.$/, '');
			const normalizedAns = answer.replace(/\s+/g, ' ').trim().toLowerCase().replace(/\.$/, '');

			if (normalized === normalizedAns || normalized.includes(normalizedAns) || normalizedAns.includes(normalized)) {
				// prefer clicking an associated input if present
				const input = el.querySelector('input') || (el.previousElementSibling && el.previousElementSibling.tagName === 'INPUT' ? el.previousElementSibling : null);
				if (input) {
						input.click();
					} else {
						el.click();
					}
					// after selecting, optionally click Next when automating
					if (isAutomating) {
						setTimeout(() => {
							try {
								clickNextIfPresent();
							} catch (e) {
								if (ixlDebug) console.error('IXL Auto: clickNextIfPresent error', e);
							}
						}, 600);
					}
					return true;
			}
		}

		// fallback: try to click any radio/checkbox whose label matches
		const inputs = Array.from(container.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
		for (const inp of inputs) {
			const lab = container.querySelector('label[for="' + inp.id + '"]');
			const labText = lab ? lab.textContent.trim().toLowerCase() : '';
			if (labText && labText.includes(answer.toLowerCase())) {
				inp.click();
				return true;
			}
		}

		// nothing matched; just log
		if (ixlDebug) console.log('IXL Auto: Unable to automatically match answer:', answer);
	} catch (e) {
		if (ixlDebug) console.error('Error applying answer:', e);
	}
}

function clickNextIfPresent() {
	// Try common next button selectors, otherwise search buttons with text 'Next'
	const selectors = ['.next', '.next-button', 'button.next', '.btn-next', '[data-action="next"]'];
	for (const sel of selectors) {
		try {
			const el = document.querySelector(sel);
			if (el && !el.disabled) {
				el.click();
				if (ixlDebug) console.log('IXL Auto: clicked next via selector', sel);
				return true;
			}
		} catch (e) {}
	}

	// Fallback: find visible button with text 'next'
	const btns = Array.from(document.querySelectorAll('button,input[type="button"],a'));
	for (const b of btns) {
		const txt = (b.textContent || b.value || '').trim().toLowerCase();
		if (txt === 'next' || txt === 'continue' || txt.startsWith('next ')) {
			if (!b.disabled) {
				b.click();
				if (ixlDebug) console.log('IXL Auto: clicked next by text', txt);
				return true;
			}
		}
	}

	if (ixlDebug) console.log('IXL Auto: no next button found');
	return false;
}

function checkForQuestion() {
	if (!isAutomating) return;

	const container = document.querySelector('div.seecontentpiece');
	if (!container) {
		// keep watching
		setTimeout(checkForQuestion, 800);
		return;
	}

	const qData = getQuestionDataFromContainer(container);
	if (!qData) {
		setTimeout(checkForQuestion, 800);
		return;
	}

	const h = hashString(qData.question + JSON.stringify(qData.options));
	if (h === lastQuestionHash) {
		// same question, poll again
		setTimeout(checkForQuestion, 800);
		return;
	}

	lastQuestionHash = h;

	chrome.runtime.sendMessage({ type: 'sendQuestionToChatGPT', question: qData }, (resp) => {
		// response handled via message listener
	});

	setTimeout(checkForQuestion, 1500);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.type === 'processChatGPTResponse') {
		try {
			const parsed = JSON.parse(message.response);
			applyAnswer(parsed);
		} catch (e) {
			console.error('IXL: invalid AI response', e, message.response);
		}
		sendResponse({ received: true });
		return true;
	}
});

// initialize - respect stored setting and debug flag
if (chrome && chrome.storage && chrome.storage.sync) {
	chrome.storage.sync.get({ ixlAutoEnabled: true, ixlDebug: false }, (items) => {
		ixlDebug = !!items.ixlDebug;
		if (items.ixlAutoEnabled) {
			try {
				addAutomationButton();
			} catch (e) {
				if (ixlDebug) console.error('Failed to add automation button', e);
			}
		}
	});
} else {
	try {
		addAutomationButton();
	} catch (e) {
		console.error('Failed to add automation button', e);
	}
}

// react to settings changes
if (chrome && chrome.storage && chrome.storage.onChanged) {
	chrome.storage.onChanged.addListener((changes) => {
		if (changes.ixlAutoEnabled) {
			const newVal = changes.ixlAutoEnabled.newValue;
			const existingBtn = document.querySelector('div[data-ixl-auto-button]');
			if (!newVal && existingBtn) {
				// disable: remove button and stop automation
				isAutomating = false;
				existingBtn.remove();
				if (ixlDebug) console.log('IXL Auto: disabled via settings');
			} else if (newVal && !existingBtn) {
				addAutomationButton();
			}
		}

		if (changes.ixlDebug) {
			ixlDebug = !!changes.ixlDebug.newValue;
			if (ixlDebug) console.log('IXL Auto: debug enabled');
		}
	});
}

