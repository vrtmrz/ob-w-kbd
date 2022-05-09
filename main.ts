import { Editor, MarkdownView, Plugin, sanitizeHTMLToDom } from 'obsidian';


interface WorkaroundKeyboardSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: WorkaroundKeyboardSettings = {
	mySetting: 'default'
}

const toggleElement = (element:HTMLElement,visible:boolean)=>{
	if(visible){
	element.style.display="";
	}else{
		element.style.display="none";

	}
}

export default class WorkaroundKeyboardPlugin extends Plugin {
	settings: WorkaroundKeyboardSettings;
	textareaWrapper: HTMLElement;
	textarea: HTMLTextAreaElement;

	target: Node;
	targetParent: Node;
	editor: Editor;
	popupElement: HTMLElement;
	popupSpacer: HTMLElement;
	popupPreview: HTMLElement;

	showTextarea(editor: Editor) {
		toggleElement(this.textareaWrapper,true);
		this.popupPreview.textContent = "";
		toggleElement(this.popupElement,true);
		this.editor = editor;
		setTimeout(() =>
			this.textarea.focus()
			, 10)

	}
	hideTextarea() {
		toggleElement(this.popupElement,false);
		toggleElement(this.textareaWrapper,false);
		this.textarea.value = "";
		if (this.editor != null) {
			this.editor.focus();
		}
	}
	previewText() {
		let content = this.textarea.value ?? "";
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
		let el = document.createElement("div");

		this.targetParent.insertBefore(el, this.target);
		el.addClass("workaround-keyboard");
		this.textarea = el.createEl("textarea");
		el.appendChild(this.textarea);
		this.textareaWrapper = el;
		this.textarea.addEventListener("blur", () => {
			this.hideTextarea();
		})
		this.textarea.addEventListener("keyup", () => {
			this.previewText();
		})
		this.textarea.addEventListener("keydown", (evt: KeyboardEvent) => {
			// console.log(evt)
			this.previewText();
			let content = this.textarea.value;
			if (evt.key == "Enter") {
				if (evt.isComposing) return;
				evt.preventDefault();
				this.editor.replaceSelection(content);
				this.hideTextarea();
			}
			if (evt.key == "Escape") {
				evt.preventDefault();
				this.hideTextarea();
			}
			if (evt.key == "Backspace" && this.textarea.value.length == 0) {
				evt.preventDefault();
				this.hideTextarea();
			}
		})

		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.hideTextarea));
		this.registerEvent(this.app.workspace.on("file-open", () => this.hideTextarea));
		// window.addEventListener("visibilitychange", this.watchWindowVisiblity);
		this.hideTextarea();

		await this.loadSettings();

		this.addCommand({
			id: 'workaround-keyboard-begin',
			name: 'Open input box',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.showTextarea(editor);
				const selected = editor.getSelection();
				this.textarea.value = selected ?? "";
				const pos = window.getSelection().getRangeAt(0).getBoundingClientRect()
				this.popupElement.style.left = `0px`;
				this.popupSpacer.style.textIndent = `${pos.left}px`;
				this.popupElement.style.top = `${pos.top - 1}px`;
				this.popupPreview.style.textIndent = "0";
			}
		});
		// this.registerDomEvent(document, 'keydown', (evt: KeyboardEvent) => {
		// 	//TODO:hook automatic inputarea show
		// 	if (evt.key == "å") {
		// 		if (document.activeElement.hasClass("cm-content")) {
		// 			console.log("Here!")
		// 		}
		// 	}
		// });
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

