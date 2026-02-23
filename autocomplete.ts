
const DEBUG = false

export interface AutoCompleteOptions
{
	allowNew:       boolean
	fetchAttribute: string
}

const defaultOptions: AutoCompleteOptions = {
	allowNew:       false,
	fetchAttribute: 'data-fetch'
}

interface Item
{
	caption: string
	id:      number
}

export class AutoComplete
{
	fetching?:   string
	idInput?:    HTMLInputElement
	input:       HTMLInputElement
	lastItems:   Item[] = []
	lastKey =    ''
	lastStart =  ''
	options:     AutoCompleteOptions
	suggestions: Suggestions

	constructor(input: HTMLInputElement, options: Partial<AutoCompleteOptions> = {})
	{
		if (DEBUG) console.log('new AutoComplete()', input, options)
		this.input       = this.initInput(input)
		this.idInput     = this.initIdInput()
		this.options     = Object.assign(defaultOptions, options)
		this.suggestions = new Suggestions(this)
		this.initParent()

		input.addEventListener('blur',    event    => this.onBlur(event))
		input.addEventListener('keydown', event    => this.onKeyDown(event))
		input.addEventListener('input',   event    => this.onInput(event))
		input.addEventListener('touchstart', event => this.onTouchStart(event))
	}

	autoComplete()
	{
		if (DEBUG) console.log('autoComplete()', this)
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
		if (DEBUG) console.log('autoEmptyClass()', this.input.value)
		const input     = this.input
		const classList = input.classList
		if (input.value === '') {
			if (DEBUG) console.log('  + empty')
			classList.add('empty')
			return
		}
		if (DEBUG) console.log('  - empty')
		classList.remove('empty')
		if (!classList.length) {
			input.removeAttribute('class')
		}
	}

	autoIdInputValue()
	{
		if (DEBUG) console.log('autoIdInputValue', this.suggestions.selected())
		const idInput = this.idInput
		if (!idInput) return
		const input      = this.input
		const suggestion = this.suggestions.selected()
		idInput.value = (suggestion && (toInsensitive(input.value) === toInsensitive(suggestion.caption)))
			? (suggestion.id ? ('' + suggestion.id) : '')
			: ''
		if (DEBUG) console.log('  idInput =', idInput.value)
	}

	consumeSelectedChar(event: KeyboardEvent)
	{
		if (event.key.length !== 1) return false
		if (event.ctrlKey || event.altKey || event.metaKey) return false
		if (!this.lastItems[this.lastItems.length - 1]?.id) return false

		const input = this.input
		const start = input.selectionStart
		const end   = input.selectionEnd

		if ((start === null) || (end === null) || (start === end)) return false

		const firstSelectedChar = input.value.slice(start, start + 1)

		if (toInsensitive(event.key) !== toInsensitive(firstSelectedChar)) return false

		if (DEBUG) console.log('consumeSelectedChar(' + event.key + ')')
		event.preventDefault()
		input.setSelectionRange(start + 1, input.value.length)
		this.fetch(event.key)

		return true
	}

	fetch(lastKey = '')
	{
		const input      = this.input
		const startsWith = ((input.selectionStart !== null) && (input.selectionEnd === input.value.length))
			? input.value.slice(0, input.selectionStart)
			: input.value
		if (DEBUG) console.log('fetch() with lastStart =', this.lastStart)
		if (this.lastStart.length && toInsensitive(startsWith).startsWith(this.lastStart) && !this.suggestions.partial) {
			this.fetchDone(undefined, startsWith, lastKey)
			return
		}
		this.lastStart = toInsensitive(startsWith)
		if (this.fetching) {
			if (startsWith !== this.fetching) {
				setTimeout(() => this.fetch(lastKey), 50)
			}
			return
		}
		this.fetching        = startsWith
		const fetchAttribute = this.options.fetchAttribute
		const dataFetch      = input.closest<HTMLElement>('[' + fetchAttribute + ']')?.getAttribute(fetchAttribute)
		const requestInit: RequestInit = { headers: { Accept: 'application/json' } }
		const url = dataFetch + '?limit&startsWith=' + startsWith
		if (DEBUG) console.log('fetch()', 'limit&startsWith=' + startsWith)
		fetch(url, requestInit).then(response => response.text())
			.then(json => this.fetchDone(
				(JSON.parse(json) as [string, string][]).map(([id, caption]) => ({ caption, id: +id })),
				startsWith,
				lastKey
			))
			.catch(() => {
				this.fetching = undefined
				setTimeout(() => this.fetch(lastKey), 100)
			})
	}

	fetchDone(items: Item[] | undefined, startsWith: string, lastKey: string)
	{
		if (items) {
			this.lastItems = items
		}
		else {
			items = this.lastItems
		}
		this.fetching = undefined
		this.updateSuggestions(items, startsWith)
		if (!['Backspace', 'Delete'].includes(lastKey)) {
			this.autoComplete()
		}
		this.onInputValueChange()
		this.autoIdInputValue()
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

	initParent()
	{
		const parent = this.input.parentElement
		if (!parent) return
		parent.style.position = 'relative'
	}

	keyDown(event: Event)
	{
		if (DEBUG) console.log('keyDown()')
		if (this.openSuggestions(event)) return
		if (this.suggestions.isLastSelected()) return
		this.suggest(this.suggestions.selectNext()?.caption)
	}

	keyEnter(event: Event)
	{
		if (DEBUG) console.log('keyEnter()')
		const suggestions = this.suggestions
		if (!suggestions.isVisible()) return
		event.preventDefault()
		this.select()
		suggestions.hide()
	}

	keyEscape(event: Event)
	{
		if (DEBUG) console.log('keyEscape')
		const suggestions = this.suggestions
		if ((this.input.value === '') && !suggestions.isVisible()) {
			return
		}
		event.preventDefault()
		if (suggestions.isVisible()) {
			suggestions.hide()
			return
		}
		if (DEBUG) console.log('input.value =')
		this.input.value = ''
		this.onInputValueChange()
		this.autoIdInputValue()
	}

	keyUp(event: Event)
	{
		if (DEBUG) console.log('keyUp()')
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

	onBlur(_event: Event)
	{
		if (DEBUG) console.log('onBlur()')
		const suggestion = this.suggestions.selected()
		this.suggestions.removeList()
		if (
			suggestion
			&& this.idInput?.value
			&& (this.input.value !== suggestion.caption)
			&& (toInsensitive(this.input.value) === toInsensitive(suggestion.caption))
		) {
			this.input.value = suggestion.caption
			this.onInputValueChange()
		}
		else if (!this.options.allowNew && this.idInput && this.input.value && !this.idInput.value) {
			this.input.value = ''
			this.onInputValueChange()
			this.autoIdInputValue()
		}
	}

	onInput(event: Event)
	{
		if (DEBUG) console.log('onInput()')
		if (document.activeElement !== event.target) return
		if (this.input.dataset.lastValue === this.input.value) return
		this.fetch(this.lastKey)
	}

	onInputValueChange()
	{
		if (DEBUG) console.log('onInputValueChange()')
		this.input.dataset.lastValue = this.input.value
		this.input.dispatchEvent(new Event('input', { bubbles: true }))
		if (document.activeElement !== this.input) { {
			this.input.dispatchEvent(new Event('change', { bubbles: true }))
		}}
		this.autoEmptyClass()
	}

	onKeyDown(event: KeyboardEvent)
	{
		if (DEBUG) console.log('########## onKeyDown()', event.key)
		this.lastKey = event.key
		if (this.consumeSelectedChar(event)) return
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

	onTouchStart(event: Event)
	{
		this.openSuggestions(event)
	}

	openSuggestions(event: Event)
	{
		if (DEBUG) console.log('openSuggestions()')
		const suggestions = this.suggestions
		if (!suggestions.length) {
			if (DEBUG) console.log('OS: no suggestions => fetch')
			this.fetch()
		}
		if (suggestions.isVisible()) {
			if (DEBUG) console.log('OS: isVisible is true => return')
			return false
		}
		if ((suggestions.length > 1) || (!this.input.value.length && suggestions.length)) {
			if (DEBUG) console.log('OS: has items => show')
			event.preventDefault()
			suggestions.show()
		}
		return true
	}

	select()
	{
		if (DEBUG) console.log('select()')
		const suggestions = this.suggestions
		const suggestion  = suggestions.selected()
		if (!suggestion) return
		if (DEBUG) console.log('  input =', suggestion.caption)
		this.input.value = suggestion.caption
		this.onInputValueChange()
		this.autoIdInputValue()
	}

	suggest(value?: string)
	{
		if (DEBUG) console.log('suggest()', value)
		if (typeof value !== 'string') {
			return
		}
		const input    = this.input
		const position = input.selectionStart
		if (DEBUG) console.log('  input =', input.value)
		input.value    = value
		input.setSelectionRange(position, input.value.length)
		this.autoComplete()
		this.onInputValueChange()
		this.autoIdInputValue()
	}

	updateSuggestions(items: Item[], startsWith = '')
	{
		startsWith = toInsensitive(startsWith)
		const suggestions = startsWith.length
			? items.filter(item => (item.caption === '...') || toInsensitive(item.caption).startsWith(startsWith))
			: items
		this.suggestions.update(suggestions)
	}

}

class Suggestions
{

	length = 0

	list?: HTMLUListElement

	partial = false

	pointerStart?: { id: number, item: HTMLLIElement, x: number, y: number }

	constructor(public autoComplete: AutoComplete)
	{}

	createList()
	{
		if (DEBUG) console.log('createList()')
		const list = this.list = document.createElement('ul')
		list.classList.add('suggestions')
		this.autoComplete.input.insertAdjacentElement('afterend', list)
		list.addEventListener('pointerdown',   event => this.onPointerDown(event))
		list.addEventListener('pointercancel', event => this.onPointerCancel(event))
		list.addEventListener('pointermove',   event => this.onPointerMove(event))
		list.addEventListener('pointerup',     event => this.onPointerUp(event))
		return list
	}

	first(): Item | null
	{
		if (DEBUG) console.log('first()')
		const item = this.list?.firstElementChild as HTMLLIElement ?? null
		return item && { caption: item.innerText, id: +(item.dataset.id ?? 0) }
	}

	hide()
	{
		if (DEBUG) console.log('hide()')
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

	onPointerDown(event: PointerEvent)
	{
		if (DEBUG) console.log('onPointerDown()', event.button)
		if ((event.pointerType === 'mouse') && (event.button !== 0)) return
		if (!(event.target instanceof Element)) return
		const item = event.target.closest<HTMLLIElement>('.suggestions > li')
		const list = this.list
		if (DEBUG) console.log('  item', item, 'list', list)
		if (!item || !list) return
		if (DEBUG) console.log('  select', item)
		if (event.pointerType !== 'mouse') {
			this.pointerStart = { id: event.pointerId, item, x: event.clientX, y: event.clientY }
			return
		}
		this.unselect()
		item.classList.add('selected')
		this.autoComplete.select()
		this.pointerStart = undefined

		const input = this.autoComplete.input
		if (DEBUG) console.log('down: focus+setSelectionRange', input.value)
		setTimeout(() => {
			input.focus()
			input.setSelectionRange(0, input.value.length)
		})
	}

	onPointerCancel(_event: PointerEvent)
	{
		this.pointerStart = undefined
	}

	onPointerMove(event: PointerEvent)
	{
		if (!this.pointerStart || (event.pointerId !== this.pointerStart.id)) return
		const distance = Math.abs(event.clientX - this.pointerStart.x) + Math.abs(event.clientY - this.pointerStart.y)
		if (distance < 8) return
		this.pointerStart = undefined
	}

	onPointerUp(event: PointerEvent)
	{
		if (!this.pointerStart || (event.pointerId !== this.pointerStart.id)) return
		this.unselect()
		this.pointerStart.item.classList.add('selected')
		this.autoComplete.select()
		this.pointerStart = undefined

		const input = this.autoComplete.input
		if (DEBUG) console.log('up: focus+setSelectionRange', input.value)
		setTimeout(() => {
			input.focus()
			input.setSelectionRange(0, input.value.length)
		})
	}

	removeList()
	{
		if (DEBUG) console.log('removeList()')
		if (!this.list) return
		this.length = 0
		this.list.remove()
		this.list = undefined
	}

	selected(item: HTMLLIElement | null = null): Item | null
	{
		item ??= this.list?.querySelector<HTMLLIElement>('li.selected') ?? null
		if (DEBUG) console.log('selected()', item && { caption: item.innerText, id: +(item.dataset.id ?? 0) })
		return item && { caption: item.innerText === '...' ? '' : item.innerText, id: +(item.dataset.id ?? 0) }
	}

	selectFirst()
	{
		if (DEBUG) console.log('selectFirst()', this.list?.firstElementChild)
		const list = this.list
		if (!list) return
		this.unselect()
		list.firstElementChild?.classList.add('selected')
	}

	selectNext()
	{
		if (DEBUG) console.log('selectNext()')
		return this.selected(this.selectSibling('nextElementSibling'))
	}

	selectPrevious()
	{
		if (DEBUG) console.log('selectPrevious()')
		return this.selected(this.selectSibling('previousElementSibling'))
	}

	selectSibling(sibling: 'nextElementSibling' | 'previousElementSibling')
	{
		if (DEBUG) console.log('selectSibling()')
		const list = this.list
		if (!list) return null
		let item = list.querySelector<HTMLLIElement>('li.selected')
		if (item && item[sibling]) {
			this.unselect(item)
			item = item[sibling] as HTMLLIElement
			item.classList.add('selected')
			item.scrollIntoView({ block: 'nearest' })
		}
		if (DEBUG) console.log(' ', item)
		return item
	}

	show()
	{
		if (DEBUG) console.log('show()')
		if (this.list) {
			this.list.style.removeProperty('display')
			if (!this.list.getAttribute('style')?.length) {
				this.list.removeAttribute('style')
			}
			return this.list
		}
		return this.createList()
	}

	unselect(item = this.list?.querySelector<HTMLLIElement>('li.selected'))
	{
		if (DEBUG) console.log('unselect()')
		if (!item) return
		const classList = item.classList
		if (!classList) return
		classList.remove('selected')
		if (!classList.length) {
			item.removeAttribute('class')
		}
	}

	update(suggestions: Item[])
	{
		if (DEBUG) console.log('update()', suggestions)
		let   hasSelected = false
		const list        = this.list ?? this.createList()
		const selected    = list.querySelector<HTMLLIElement>('li.selected')?.innerText
		list.innerHTML    = ''
		this.length       = suggestions.length
		this.partial      = false
		for (const suggestion of suggestions) {
			const item      = document.createElement('li')
			item.dataset.id = '' + suggestion.id
			item.innerText  = suggestion.caption
			if (suggestion.caption === selected) {
				hasSelected = true
				item.classList.add('selected')
			}
			list.appendChild(item)
			if (!suggestion.id && (suggestion.caption === '...')) {
				this.partial = true
			}
		}
		if (DEBUG) console.log('- length =', this.length)
		if (DEBUG) console.log('- partial =', this.partial ? 'true' : 'false')
		if (!hasSelected) {
			list.firstElementChild?.classList.add('selected')
		}
		if (this.length > 1) {
			if (!this.isVisible()) this.show()
		}
		else {
			if (this.isVisible()) this.hide()
		}
	}

}

function toInsensitive(text: string)
{
	return text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
}
