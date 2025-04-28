
interface HTMLAutoCompleteInputElement extends HTMLInputElement
{
	lastValue:      string
	selectedValue?: string
}

export class AutoComplete
{

	idInput?: HTMLInputElement

	input: HTMLAutoCompleteInputElement

	suggestions: Suggestions

	constructor(input: HTMLInputElement)
	{
		this.input       = Object.assign(input, { lastValue: input.value })
		this.suggestions = new Suggestions(this)
		this.autoIdInput()

		input.addEventListener('blur',    event => this.onBlur(event))
		input.addEventListener('keydown', event => this.onKeyDown(event))
		input.addEventListener('input',   event => this.onInput(event))
	}

	autoIdInput()
	{
		const input  = this.input
		const next   = input.nextElementSibling
		const prev   = input.previousElementSibling
		this.idInput
			= ((next instanceof HTMLInputElement) && (next.type === 'hidden')) ? next
			: ((prev instanceof HTMLInputElement) && (prev.type === 'hidden')) ? prev
			: undefined
	}

	emptyClass()
	{
		const input     = this.input
		const classList = input.classList
		if (!input.value.length) {
			classList.add('empty')
			delete input.selectedValue
			if (this.idInput) this.idInput.value = ''
			return
		}
		if (classList.contains('empty')) {
			(classList.length > 1)
				? classList.remove('empty')
				: input.removeAttribute('class')
		}
	}

	fetch()
	{
		const input     = this.input
		const dataFetch = input.dataset.fetch ?? input.closest<HTMLElement>('[data-fetch]')?.dataset.fetch
		const requestInit: RequestInit = { headers: { Accept: 'application/json' } }
		const summaryRoute = dataFetch + '?startsWith=' + input.value
		fetch(summaryRoute, requestInit).then(response => response.text()).then(json => {
			const summary:    [string, string][] = JSON.parse(json)
			const startsWith  = input.value.toLowerCase()
			const suggestions = summary.map(([id, caption]) => ({ caption, id: +id }))
				.filter(item => item.caption.toLowerCase().startsWith(startsWith))
			this.suggestions.update(suggestions)
			const suggestion = this.suggestions.first()
			if (!suggestion) {
				delete input.selectedValue
				if (this.idInput) this.idInput.value = ''
				return
			}
			const caption = suggestion.caption
			input.selectedValue = caption
			if (this.idInput) this.idInput.value = '' + suggestion.id
			const position = input.value.length
			input.setRangeText(caption.slice(position))
			input.setSelectionRange(position, input.value.length)
		})
	}

	onBlur(_event: FocusEvent)
	{
		const input = this.input
		if (!input.selectedValue) return
		input.value = input.selectedValue
	}

	onKeyDown(event: KeyboardEvent)
	{
		switch (event.key) {
			case 'ArrowDown':
			case 'Down':
				return this.suggestions.show()
			case 'ArrowUp':
			case 'Up':
				return this.suggestions.hide()
		}
	}

	onInput(_event: Event)
	{
		if (this.input.lastValue === this.input.value) {
			return
		}
		this.fetch()
	}

}

class Suggestions
{

	list: HTMLUListElement

	constructor(public combo: AutoComplete)
	{
		const list = this.list = document.createElement('ul')
		list.classList.add('suggestions')
		list.style.display = 'none'
		combo.input.insertAdjacentElement('afterend', list)
	}

	first(): { caption: string, id: number }
	{
		const item = this.list.firstElementChild as HTMLLIElement
		return { caption: item.innerText, id: +(item.dataset.id ?? 0) }
	}

	hide()
	{
		this.list.style.display = 'none'
	}

	show()
	{
		this.list.style.removeProperty('display')
	}

	update(suggestions: { caption: string, id: number }[])
	{
		const list     = this.list
		list.innerHTML = ''
		for (const suggestion of suggestions) {
			const item      = document.createElement('li')
			item.dataset.id = '' + suggestion.id
			item.innerText  = suggestion.caption
			list.appendChild(item)
		}
		list.firstElementChild?.classList.add('selected')
	}

}
