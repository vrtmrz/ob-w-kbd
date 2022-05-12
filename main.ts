import {App, Editor, MarkdownView, Plugin, PluginSettingTab, Setting, View} from "obsidian";


interface WorkaroundKeyboardSettings {
	keepInputBoxOpen: boolean;
	autofocus: boolean;
	autofocusAfterCommit: boolean;
}

const DEFAULT_SETTINGS: WorkaroundKeyboardSettings = {
	keepInputBoxOpen: false,
	autofocus: false,
	autofocusAfterCommit: false,
}


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
	view: View;
	popupElement: HTMLElement;
	popupSpacer: HTMLElement;
	popupPreview: HTMLElement;
	offsetForCaret = 0;
	scrollStart = 0;

	settings: WorkaroundKeyboardSettings;
	isTextAreaShowing: boolean;

	onScroll() {
		const curScroll = this.scrollStart - this.view.containerEl.querySelector(".cm-scroller")?.scrollTop;
		console.log(curScroll);
		this.popupElement.style.marginTop = `${curScroll}px`;
	}

	showTextarea(editor: Editor, view: View) {
		this.bindEditorAndView(editor, view);
		// If something selected, we can edit this again.
		if (!this.isTextAreaShowing) {
			const selected = editor.getSelection();
			this.textarea.value = selected ?? "";
			this.previewText();
			toggleElement(this.textareaWrapper, true);
			toggleElement(this.popupElement, true);
			this.isTextAreaShowing = true;

		}

	}

	bindEditorAndView(editor: Editor, view: View) {
		this.unbindEditorAndView();
		this.view = view;
		this.view.containerEl.querySelector(".cm-scroller")?.addEventListener("scroll", this.onScroll)
		this.editor = editor;
	}

	unbindEditorAndView() {
		if (this.view != null) {
			this.view.containerEl.querySelector(".cm-scroller")?.removeEventListener("scroll", this.onScroll);
			this.view = null;
		}
		this.editor = null;
	}

	hideTextarea(force?: boolean) {
		this.textarea.value = "";

		if (force || !this.settings.keepInputBoxOpen) {
			toggleElement(this.popupElement, false);
			toggleElement(this.textareaWrapper, false);
			this.isTextAreaShowing = false;
			this.unbindEditorAndView();
		} else {
			this.previewText();
		}
		if (this.editor != null) {
			this.editor.focus();
		}
	}

	previewText() {
		const content = this.textarea.value ?? "";
		this.popupPreview.textContent = content;
	}


	async onload() {
		await this.loadSettings();
		this.onScroll = this.onScroll.bind(this)
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
			let content = this.textarea.value + "";
			if (evt.key == "Enter") {
				if (content == "" && this.settings.autofocusAfterCommit) {
					content = "\n";
				}
				if (evt.isComposing) return;
				evt.preventDefault();

				this.editor.replaceSelection(content);

				this.hideTextarea();
				if (this.settings.autofocusAfterCommit) {
					this.adjustPopup();
					this.textarea.focus();
				}
			}
			if (evt.key == "Escape") {
				if (evt.isComposing) return;
				evt.preventDefault();
				this.hideTextarea(true);
			}
			if (evt.key == "Backspace" && this.textarea.value.length == 0) {
				if (evt.isComposing) return;
				evt.preventDefault();
				this.hideTextarea();

			}
		});
		let lastCursor = {ch: 0, line: 0};
		this.app.workspace.on("editor-change", () => {
			if (!this.isTextAreaShowing) return;
			if (!this.editor) return;
			const cursor = this.editor.getCursor();
			if (cursor.ch == lastCursor.ch && cursor.line == lastCursor.line) return;
			lastCursor = cursor;
			this.adjustPopup();
		})

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {

				if (!this.settings.keepInputBoxOpen) {
					if (leaf && (leaf.view as MarkdownView).editor) {
						const newEditor = (leaf.view as MarkdownView).editor;

						// If already selected, skip.
						// if (this.textAreaShowing) {

						if (this.editor !== newEditor) {
							this.bindEditorAndView(newEditor, leaf.view);
						}
					}
					this.hideTextarea();
				} else {
					if (this.isTextAreaShowing) {
						lastCursor = {ch: 0, line: 0};
						if (leaf && (leaf.view as MarkdownView).editor) {
							const newEditor = (leaf.view as MarkdownView).editor;

							// If already selected, skip.
							if (this.editor === newEditor) return;
							if (this.textarea.value != "") {
								// When buffer were left, reflect once.
								this.editor.replaceSelection(this.textarea.value);
								this.textarea.value = "";
								this.previewText();
							}
							if (this.settings.autofocus) {
								openInputBox(newEditor, leaf.view);
							} else {
								this.bindEditorAndView(newEditor, leaf.view);
								this.adjustPopup();
							}
						}
					}

				}
			})
		);


		this.hideTextarea(true);


		const openInputBox = (editor: Editor, view: View) => {

			this.showTextarea(editor, view);
			if (!this.editor.hasFocus()) {
				// If editor doesn't have focus, it will be in complicated status.
				this.editor.focus();
				setTimeout(() => {
					openInputBox(editor, view);
				}, 10);
				return;
			}
			this.adjustPopup();
			setTimeout(() => {
				this.textarea.focus()

			}, 10);
		};
		this.addCommand({
			id: "workaround-keyboard-begin",
			name: "Open input box",
			editorCallback: openInputBox,
		});
		this.addSettingTab(new WorkaroundKeyboardSetting(this.app, this));
	}

	adjustPopup() {
		const editor = this.editor;
		const view = this.view;
		// @ts-ignore
		const parentDOM = editor?.cm?.contentDOM || view?.contentEl || document;


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
			pos = getClientRect(cmSelection[0]);
		} else {
			// Workaround for content-editable lost the range when caret is on the start or end of the line.
			const clone = range.cloneRange();
			const fixedPosition = range.endOffset;
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
		this.scrollStart = this.view.containerEl.querySelector(".cm-scroller")?.scrollTop;
		this.popupElement.style.marginTop = "0px";
		this.popupElement.style.width = `${lineBounds.width}px`;
		this.popupElement.style.height = `${styles.height}`;
		this.popupPreview.style.height = `${styles.height}`;
		this.popupElement.style.lineHeight = `${styles.lineHeight}`;
		this.popupPreview.style.lineHeight = `${styles.lineHeight}`;
		this.popupSpacer.style.textIndent = `${(pos.left) - (lineBounds.x + paddingLeft)}px`;
		// Adjusting the top. Without this, the letters is little corrupted.
		this.popupElement.style.top = `${pos.top - this.offsetForCaret}px`;
		this.popupPreview.style.textIndent = "0";
	}

	onunload() {
		if (this.textareaWrapper != null) {
			this.targetParent.removeChild(this.textareaWrapper);
			this.textareaWrapper = null;
			document.body.removeChild(this.popupElement);
		}
		this.unbindEditorAndView();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class WorkaroundKeyboardSetting extends PluginSettingTab {
	plugin: WorkaroundKeyboardPlugin;

	constructor(app: App, plugin: WorkaroundKeyboardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings of Workaround keyboard'});

		new Setting(containerEl)
			.setName('Keep input box opened.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.keepInputBoxOpen)
				.onChange(async (value) => {
					this.plugin.settings.keepInputBoxOpen = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Autofocus')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autofocus)
				.onChange(async (value) => {
					this.plugin.settings.autofocus = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Autofocus after committing text.')
			.setDesc("When this feature enabled, pressing enter key with empty input makes newline.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autofocusAfterCommit)
				.onChange(async (value) => {
					this.plugin.settings.autofocusAfterCommit = value;
					await this.plugin.saveSettings();
				}));
	}
}
