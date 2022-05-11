import {Editor, MarkdownView, Plugin} from "obsidian";


const toggleElement = (element: HTMLElement, visible: boolean) => {
	if (visible) {
		element.style.display = "";
	} else {
		element.style.display = "none";
	}
};

export default class WorkaroundKeyboardPlugin extends Plugin {
	textareaWrapper: HTMLElement;
	textarea: HTMLTextAreaElement;

	target: Node;
	targetParent: Node;
	editor: Editor;
	popupElement: HTMLElement;
	popupSpacer: HTMLElement;
	popupPreview: HTMLElement;
	offsetForCaret = 0;

	showTextarea(editor: Editor) {
		toggleElement(this.textareaWrapper, true);
		this.popupPreview.textContent = "";
		toggleElement(this.popupElement, true);
		this.editor = editor;
		setTimeout(() => this.textarea.focus(), 10);
	}

	hideTextarea() {
		toggleElement(this.popupElement, false);
		toggleElement(this.textareaWrapper, false);
		this.textarea.value = "";
		if (this.editor != null) {
			this.editor.focus();
		}
	}

	previewText() {
		const content = this.textarea.value ?? "";
		if (this.popupElement) {
			this.popupPreview.textContent = content;
		}
	}


	async onload() {
		this.popupElement = document.createElement("span");
		this.popupPreview = document.createElement("span");
		this.popupSpacer = document.createElement("span");
		this.popupElement.addClass("workaround-keyboard-popup");
		this.popupPreview.addClass("preview");
		this.popupSpacer.addClass("spacer");

		this.popupElement.appendChild(this.popupSpacer);
		this.popupSpacer.appendChild(this.popupPreview);

		document.body.appendChild(this.popupElement);
		this.target = document.querySelector("div.status-bar");
		this.targetParent = this.target.parentNode;
		const el = document.createElement("div");

		this.targetParent.insertBefore(el, this.target);
		el.addClass("workaround-keyboard");
		this.textarea = el.createEl("textarea");
		el.appendChild(this.textarea);
		this.textareaWrapper = el;
		this.textarea.addEventListener("blur", () => {
			this.hideTextarea();
		});
		this.textarea.addEventListener("keyup", () => {
			this.previewText();
		});
		this.textarea.addEventListener("input", () => {
			this.previewText();
		});
		this.textarea.addEventListener("change", () => {
			this.previewText();
		});
		this.textarea.addEventListener("compositionstart", () => {
			this.previewText();
		});
		this.textarea.addEventListener("compositionupdate", () => {
			this.previewText();
		});
		this.textarea.addEventListener("compositionend", () => {
			this.previewText();
		});
		this.textarea.addEventListener("keydown", (evt: KeyboardEvent) => {

			this.previewText();
			const content = this.textarea.value;
			if (evt.key == "Enter") {
				if (evt.isComposing) return;
				evt.preventDefault();
				this.editor.replaceSelection(content);
				this.hideTextarea();
			}
			if (evt.key == "Escape") {
				if (evt.isComposing) return;
				evt.preventDefault();
				this.hideTextarea();
			}
			if (evt.key == "Backspace" && this.textarea.value.length == 0) {
				if (evt.isComposing) return;
				evt.preventDefault();
				this.hideTextarea();
			}
		});

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.hideTextarea)
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => this.hideTextarea)
		);
		this.hideTextarea();
		// this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
		// 	// const focusedElement =
		// 	if(evt.isComposing) {
		// 		console.log("compositionstart")
		// 		if (document.activeElement.hasClass("cm-content")) {
		// 			evt.preventDefault()
		// 			this.showTextarea();
		// 			// this.textarea.dispatchEvent({...evt});
		//
		// 		}
		// 	}
		// });

		await this.loadSettings();
		const openInputBox = (editor: Editor, view: MarkdownView) => {
			this.showTextarea(editor);
			if (!this.editor.hasFocus()) {
				// If editor doesn't have focus, it will be in complicated status.
				this.editor.focus();
				setTimeout(() => {
					openInputBox(editor, view);
				}, 10);
				return;
			}

			// @ts-ignore
			const parentDOM = editor?.cm?.contentDOM || view?.contentEl || document;
			const selected = editor.getSelection();

			// If something selected, we can edit this again.
			this.textarea.value = selected ?? "";

			// Styles to be applied to popup preview.
			let styles: CSSStyleDeclaration;

			const selection = window.getSelection();
			const range = selection.getRangeAt(0);


			const getClientRect = (target: Range | Element): DOMRect => {
				const rects = target.getClientRects();
				if (rects.length > 0) {
					return rects[0];
				}
				return target.getBoundingClientRect();
			}

			let pos;

			// If there's cm-selection, use this.
			const cmSelection = parentDOM.querySelectorAll(".cm-line .cm-selection,.CodeMirror-line .cm-selection");
			if (cmSelection.length > 0) {
				console.dir(cmSelection);
				pos = getClientRect(cmSelection[0]);
			} else {
				console.log("looking found")
				// Workaround for content-editable lost the range when caret is on the start or end of the line.


				const clone = range.cloneRange();
				const fixedPosition = range.endOffset;
				console.log("make offset")
				if (fixedPosition + 1 > range.endContainer.childNodes.length) {
					const dummy = document.createTextNode("&#8203;");
					clone.insertNode(dummy);
					clone.selectNode(dummy);
					pos = getClientRect(clone);
					dummy.parentNode.removeChild(dummy);
				} else {
					clone.setStart(range.endContainer, fixedPosition);
					clone.setEnd(range.endContainer, fixedPosition + 1);
					pos = getClientRect(clone);
				}
				clone.detach();
			}

			// fetch the style once.
			styles = window.getComputedStyle(document.activeElement);

			// Find the DOM of bounds for wrapping popup text.
			const lineDom = parentDOM.querySelectorAll(".cm-line,.CodeMirror-line");
			let lineBounds;
			if (lineDom.length > 0) {
				lineBounds = lineDom[0].getBoundingClientRect();
				// If cm-line is found. The Style of this is more suitable than activeElement's one.
				styles = window.getComputedStyle(lineDom[0]);
			} else {
				lineBounds = parentDOM.getBoundingClientRect();
			}
			let linePos = pos;

			// Get the position of active line.
			const sx = parentDOM.querySelectorAll(".cm-active.cm-line,.CodeMirror-activeline");
			if (sx.length > 0) {
				linePos = sx[0].getBoundingClientRect();
			}

			// Fallback
			if (styles == null) {
				const sx = parentDOM.querySelectorAll(".cm-editor");
				if (sx.length > 0) {
					pos = sx[0].getBoundingClientRect();
					// Copy line style to apply
					styles = window.getComputedStyle(sx[0]);
				} else {
					styles = new CSSStyleDeclaration();
				}
			}
			// Copy fields
			const copyFields = [
				"aspectRatio",
				"boxSizing",
				"font",
				"fontDisplay",
				"fontFamily",
				"fontFeatureSettings",
				"fontKerning",
				"fontOpticalSizing",
				"fontSize",
				"fontStretch",
				"fontStyle",
				"fontSynthesis",
				"fontSynthesisSmallCaps",
				"fontSynthesisStyle",
				"fontSynthesisWeight",
				"fontVariant",
				"fontVariantCaps",
				"fontVariantEastAsian",
				"fontVariantLigatures",
				"fontVariantNumeric",
				"fontVariationSettings",
				"fontWeight",
				"forcedColorAdjust",
				"gap",
				"hyphens",
				"imageOrientation",
				"imageRendering",
				"isolation",
				"justifyContent",
				"justifyItems",
				"justifySelf",
				"letterSpacing",
				"lineHeight",
				"verticalAlign",
				"tabSize",
				"textAlign",
				"textAlignLast",
				"textAnchor",
				"textRendering",
				"textShadow",
				"textSizeAdjust",
				"textTransform",
				"textUnderlineOffset",
				"textUnderlinePosition",
				// "height",
				"padding-left",
				"padding-right",
				"zoom",
			];
			for (const fieldName of copyFields) {
				if (fieldName in styles) {
					// @ts-ignore
					this.popupElement.style[fieldName] = styles[fieldName];
				}
			}

			// Applying positions.
			// If the caret top is near to the line top, memo the offset between them.
			if ((pos.top - linePos.top) < (styles.lineHeight.replace("px", "") as unknown as never) / 2) {
				this.offsetForCaret = pos.top - linePos.top;
			}
			this.offsetForCaret = 0;
			const paddingLeft = (styles.paddingLeft.replace("px", "") as unknown as never) / 1;

			this.popupElement.style.left = `${
				lineBounds.x
			}px`;
			this.popupElement.style.width = `${lineBounds.width}px`;
			this.popupElement.style.height = `${styles.height}`;
			this.popupPreview.style.height = `${styles.height}`;
			this.popupElement.style.lineHeight = `${styles.lineHeight}`;
			this.popupPreview.style.lineHeight = `${styles.lineHeight}`;
			this.popupSpacer.style.textIndent = `${(pos.left) - (lineBounds.x + paddingLeft)}px`;
			// Adjusting the top. Without this, the letters is little corrupted.
			this.popupElement.style.top = `${pos.top - this.offsetForCaret}px`;
			this.popupPreview.style.textIndent = "0";
		};
		this.addCommand({
			id: "workaround-keyboard-begin",
			name: "Open input box",
			editorCallback: openInputBox,
		});
	}

	onunload() {
		if (this.textareaWrapper != null) {
			this.targetParent.removeChild(this.textareaWrapper);
			this.textareaWrapper = null;
			document.body.removeChild(this.popupElement);
		}
	}

	async loadSettings() {
		// this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		// await this.saveData(this.settings);
	}
}
