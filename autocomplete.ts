
interface Item
{
	caption: string
	id:      number
}

export class AutoComplete
{

	idInput?:    HTMLInputElement
	input:       HTMLInputElement
	lastKey    = ''
	suggestions: Suggestions

	constructor(input: HTMLInputElement)
	{
		this.input      = this.initInput(input)
		this.idInput    = this.initIdInput()
		this.suggestions = new Suggestions(this)

		input.addEventListener('blur',    event => this.onBlur(event))
		input.addEventListener('keydown', event => this.onKeyDown(event))
		input.addEventListener('input',   event => this.onInput(event))
	}

	autoComplete()
	{
		const input = this.input
		if (input.selectionStart !== input.value.length) {
			return
		}
		const suggestion = this.suggestions.selected()
		if (!suggestion) {
			return
		}
		const caption  = suggestion.caption
		const position = input.value.length
		if (position >= caption.length) {
			return
		}
		input.setRangeText(caption.slice(position))
		input.setSelectionRange(position, input.value.length)
	}

	autoEmptyClass()
	{
		const input     = this.input
		const classList = input.classList
		if (input.value === '') {
			classList.add('empty')
			return
		}
		classList.remove('empty')
		if (!classList.length) {
			input.removeAttribute('class')
		}
	}

	autoIdInputValue()
	{
		const idInput = this.idInput
		if (!idInput) return
		const input = this.input
		const suggestion = this.suggestions.selected()
		idInput.value = (input.value === suggestion?.caption)
			? '' + suggestion.id
			: ''
	}

	fetch()
	{
		const input     = this.input
		const dataFetch = input.dataset.fetch ?? input.closest<HTMLElement>('[data-fetch]')?.dataset.fetch
		const lastKey   = this.lastKey
		const requestInit: RequestInit = { headers: { Accept: 'application/json' } }
		const summaryRoute = dataFetch + '?startsWith=' + input.value
		fetch(summaryRoute, requestInit).then(response => response.text()).then(json => {
			const summary:    [string, string][] = JSON.parse(json)
			const startsWith  = input.value.toLowerCase()
			const suggestions = summary.map(([id, caption]) => ({ caption, id: +id }))
				.filter(item => item.caption.toLowerCase().startsWith(startsWith))
			this.suggestions.update(suggestions)
			if (!['Backspace', 'Delete'].includes(lastKey)) {
				this.autoComplete()
			}
			this.onInputValueChange()
			this.autoIdInputValue()
		})
	}

	initIdInput()
	{
		const input = this.input
		const next  = input.nextElementSibling
		const prev  = input.previousElementSibling
		return ((next instanceof HTMLInputElement) && (next.type === 'hidden')) ? next
			: ((prev instanceof HTMLInputElement) && (prev.type === 'hidden')) ? prev
			: undefined
	}

	initInput(input: HTMLInputElement)
	{
		input.dataset.lastValue = input.value
		return input
	}

	keyDown(event: KeyboardEvent)
	{
		const suggestions = this.suggestions
		if (suggestions.isLastSelected()) {
			return
		}
		event.preventDefault()
		if (!suggestions.isVisible()) {
			suggestions.show()
			return
		}
		this.suggest(suggestions.selectNext()?.caption)
	}

	keyEnter(event: KeyboardEvent)
	{
		const suggestions = this.suggestions
		if (!suggestions.isVisible()) {
			return
		}
		event.preventDefault()
		const suggestion = suggestions.selected()
		if (!suggestion) {
			return
		}
		this.input.value = suggestion.caption
		this.onInputValueChange()
		this.autoIdInputValue()
		suggestions.hide()
	}

	keyEscape(event: KeyboardEvent)
	{
		const suggestions = this.suggestions
		if ((this.input.value === '') && !suggestions.isVisible()) {
			return
		}
		event.preventDefault()
		if (suggestions.isVisible()) {
			suggestions.hide()
			return
		}
		this.input.value = ''
		this.onInputValueChange()
		this.autoIdInputValue()
	}

	keyUp(event: KeyboardEvent)
	{
		const suggestions = this.suggestions
		if (!suggestions.isVisible()) {
			return
		}
		event.preventDefault()
		if (suggestions.isFirstSelected()) {
			suggestions.hide()
			return
		}
		this.suggest(suggestions.selectPrevious()?.caption)
	}

	onBlur(_event: FocusEvent)
	{
		setTimeout(() => this.suggestions.removeList())
	}

	onInput(_event: Event)
	{
		if (this.input.dataset.lastValue === this.input.value) {
			return
		}
		this.fetch()
	}

	onInputValueChange()
	{
		this.input.dataset.lastValue = this.input.value
		this.autoEmptyClass()
	}

	onKeyDown(event: KeyboardEvent)
	{
		this.lastKey = event.key
		switch (event.key) {
			case 'ArrowDown':
			case 'Down':
				return this.keyDown(event)
			case 'ArrowUp':
			case 'Up':
				return this.keyUp(event)
			case 'Escape':
				return this.keyEscape(event)
			case 'Enter':
				return this.keyEnter(event)
		}
	}

	suggest(value?: string)
	{
		if (typeof value !== 'string') {
			return
		}
		const input    = this.input
		const position = input.selectionStart
		input.value    = value
		input.setSelectionRange(position, input.value.length)
		this.autoComplete()
		this.onInputValueChange()
		this.autoIdInputValue()
	}

}

class Suggestions
{

	list?: HTMLUListElement

	constructor(public combo: AutoComplete)
	{}

	createList()
	{
		const list = this.list = document.createElement('ul')
		list.classList.add('suggestions')
		let   input: HTMLInputElement = this.combo.input
		const idInput                 = input.nextElementSibling
		if ((idInput instanceof HTMLInputElement) && (idInput.type === 'hidden')) {
			input = idInput
		}
		input.insertAdjacentElement('afterend', list)
		return list
	}

	first(): Item | null
	{
		const item = this.list?.firstElementChild as HTMLLIElement ?? null
		return item && { caption: item.innerText, id: +(item.dataset.id ?? 0) }
	}

	hide()
	{
		const list = this.list
		if (!list) return
		list.style.display = 'none'
	}

	isFirstSelected()
	{
		return this.list
			&& this.list.firstElementChild
			&& (this.list.firstElementChild === this.list.querySelector('li.selected'))
	}

	isLastSelected()
	{
		return this.list
			&& this.list.lastElementChild
			&& (this.list.lastElementChild === this.list.querySelector('li.selected'))
	}

	isVisible()
	{
		return this.list && (this.list.style.display !== 'none')
	}

	removeList()
	{
		this.list?.remove()
		this.list = undefined
	}

	selected(item: HTMLLIElement | null = null): Item | null
	{
		item ??= this.list?.querySelector<HTMLLIElement>('li.selected') ?? null
		return item && { caption: item.innerText, id: +(item.dataset.id ?? 0) }
	}

	selectFirst()
	{
		const list = this.list
		if (!list) return
		list.querySelector('li.selected')?.classList.remove('selected')
		list.firstElementChild?.classList.add('selected')
	}

	selectNext()
	{
		return this.selected(this.selectSibling('nextElementSibling'))
	}

	selectPrevious()
	{
		return this.selected(this.selectSibling('previousElementSibling'))
	}

	selectSibling(sibling: 'nextElementSibling' | 'previousElementSibling')
	{
		const list = this.list
		if (!list) return null
		let item = list.querySelector<HTMLLIElement>('li.selected')
		if (item && item[sibling]) {
			item.classList.remove('selected')
			item = item[sibling] as HTMLLIElement
			item.classList.add('selected')
		}
		return item
	}

	show()
	{
		if (this.list) {
			this.list.style.removeProperty('display')
			return this.list
		}
		return this.createList()
	}

	update(suggestions: Item[])
	{
		if (!suggestions.length) {
			return this.hide()
		}
		let   hasSelected = false
		const list        = this.show()
		const selected    = list.querySelector<HTMLLIElement>('li.selected')?.innerText
		list.innerHTML    = ''
		for (const suggestion of suggestions) {
			const item      = document.createElement('li')
			item.dataset.id = '' + suggestion.id
			item.innerText  = suggestion.caption
			if (suggestion.caption === selected) {
				hasSelected = true
				item.classList.add('selected')
			}
			list.appendChild(item)
		}
		if (!hasSelected) {
			list.firstElementChild?.classList.add('selected')
		}
	}

}
