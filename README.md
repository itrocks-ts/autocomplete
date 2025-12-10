[![npm version](https://img.shields.io/npm/v/@itrocks/autocomplete?logo=npm)](https://www.npmjs.org/package/@itrocks/autocomplete)
[![npm downloads](https://img.shields.io/npm/dm/@itrocks/autocomplete)](https://www.npmjs.org/package/@itrocks/autocomplete)
[![GitHub](https://img.shields.io/github/last-commit/itrocks-ts/autocomplete?color=2dba4e&label=commit&logo=github)](https://github.com/itrocks-ts/autocomplete)
[![issues](https://img.shields.io/github/issues/itrocks-ts/autocomplete)](https://github.com/itrocks-ts/autocomplete/issues)
[![discord](https://img.shields.io/discord/1314141024020467782?color=7289da&label=discord&logo=discord&logoColor=white)](https://25.re/ditr)

# autocomplete

Editable combobox component featuring smart autocomplete from a list of id-caption pairs for it.rocks.

*This documentation was written by an artificial intelligence and may contain errors or approximations.
It has not yet been fully reviewed by a human. If anything seems unclear or incomplete,
please feel free to contact the author of this package.*

## Installation

```bash
npm i @itrocks/autocomplete
```

This package ships as a small, framework-agnostic ES module plus a CSS file.
You can use it directly in a browser bundle or through any bundler that
supports standard `import` statements.

At runtime you must also load the stylesheet `autocomplete.css` so that the
suggestions dropdown is correctly positioned and styled.

## Usage

`@itrocks/autocomplete` provides a smart autocomplete behavior for a plain
`<input>` element. It turns the input into an editable combobox that:

- fetches suggestions from a remote HTTP endpoint,
- displays them in a dropdown list,
- lets the user navigate with the keyboard,
- completes the text directly in the input,
- optionally keeps a hidden field in sync with the selected item id.

The core API is the `AutoComplete` class, which you instantiate on a
`HTMLInputElement` that will hold the caption shown to the user.

### Minimal example

```html
<!-- HTML -->
<input
  id="country"
  type="text"
  data-fetch="/api/countries"
  class="empty"
>
<input id="country-id" type="hidden">

<script type="module">
  import { AutoComplete } from '/node_modules/@itrocks/autocomplete/autocomplete.js'

  const captionInput = document.getElementById('country')

  // Attach autocomplete behavior to the visible input
  new AutoComplete(captionInput)
</script>
```

On each change of the visible input, the component will:

1. Call `GET /api/countries?startsWith=<current value>` with
   `Accept: application/json`.
2. Expect a JSON body shaped as an array of `[id, caption]` pairs, for
   example:

   ```json
   [["33", "France"], ["49", "Germany"], ["39", "Italy"]]
   ```

3. Display the matching captions in a dropdown list.
4. Let the user navigate the list with arrow keys and validate with `Enter`.
5. Keep the hidden `#country-id` input in sync with the selected item id.

### Complete example with common behaviors

```html
<label for="customer">Customer</label>
<input
  id="customer"
  name="customer-caption"
  type="text"
  data-fetch="/customers/summary"
  class="empty"
  autocomplete="off"
>
<!-- Hidden field containing the selected customer id -->
<input id="customer-id" name="customer-id" type="hidden">

<script type="module">
  import { AutoComplete } from '/node_modules/@itrocks/autocomplete/autocomplete.js'

  const customerCaption = document.getElementById('customer')

  // Initialize the component once the DOM is ready
  new AutoComplete(customerCaption)

  // Optionally, react to value changes using the standard 'input' event
  customerCaption.addEventListener('input', () => {
    const idInput = document.getElementById('customer-id')
    console.log('Customer caption:', customerCaption.value)
    console.log('Customer id:', idInput.value)
  })
</script>
```

In this example:

- The backend route `/customers/summary` must return JSON like
  `[["1", "Acme"], ["2", "Beta Corp"], ...]`.
- Typing in the `Customer` input shows suggestions and performs
  in-place completion.
- The hidden `customer-id` input is automatically set to the id of the
  currently selected suggestion when the caption matches exactly.
- When the user clears the caption or types a caption that does not match
  any suggestion, the hidden id is cleared.

## API

`@itrocks/autocomplete` exposes a single public class:

### `class AutoComplete`

Editable combobox behavior attached to a text input element. It keeps a
dropdown list of suggestions in sync with the input value and, when
available, with a nearby hidden input used to store the selected item id.

#### Constructor

```ts
new AutoComplete(input: HTMLInputElement)
```

Parameters:

- `input: HTMLInputElement` – The **visible** input used to type and display
  the caption. It becomes the component's main entry field.

Behavior and expectations:

- The input is considered the caption field. The user always interacts with
  this field; it remains editable at all times.
- The constructor:
  - stores the input as `autoComplete.input`,
  - looks for a **hidden** sibling input, which may be used as the
    "id" field (see below),
  - registers listeners for `blur`, `keydown` and `input` events.

#### Hidden id input detection

If you provide a hidden input to store the selected id, you *do not* have to
wire it manually. The component will automatically discover it with the
following rules:

- If the next sibling of the visible input is an `HTMLInputElement` of
  type `hidden`, it is used as the id input.
- Otherwise, if the previous sibling meets these conditions, it is used.
- If neither sibling qualifies, no id input is used and ids are simply
  ignored.

The hidden input value is automatically updated whenever the caption changes
and there is a selected suggestion whose `caption` exactly equals the visible
input value.

#### Fetching suggestions

Suggestions are loaded asynchronously from an HTTP endpoint.

The component determines the URL from the DOM:

- First it checks `input.dataset.fetch` (`data-fetch` attribute on the input
  itself).
- If not found, it walks up the DOM tree to the closest ancestor element that
  has a `data-fetch` attribute and uses its value.

Once the base URL is known, requests are performed with:

```text
GET <data-fetch>?startsWith=<current value>
Accept: application/json
```

- When the input is empty, the `?startsWith=...` suffix is omitted.
- The response must be a JSON array of `[id, caption]` items. `id` is
  converted to a number, `caption` is kept as a string.

Client-side filtering is applied so that only captions whose lowercase form
starts with the lowercase input value are proposed as suggestions.

#### Keyboard interaction

The following keys are handled while the input has focus:

- `ArrowDown` / legacy `Down` – Opens the suggestions list (if there is more
  than one suggestion) or moves the selection one item down.
- `ArrowUp` / legacy `Up` – Moves the selection one item up; if already at the
  first item, the list is closed.
- `Enter` – Confirms the currently selected suggestion, copies its caption
  into the input, updates the hidden id input (if any) and hides the list.
- `Escape` – If the list is visible, simply closes it. If the list is hidden,
  clears the input value and resets the hidden id input.

Mouse interactions (clicking on a suggestion) are also supported through the
internal implementation, thanks to the `<ul class="suggestions">` element
rendered next to the input.

#### Input value changes and events

Every time the input value is programmatically changed by the component
(`autoComplete`, suggestion selection...), the component:

1. Stores the new value in `input.dataset.lastValue`.
2. Dispatches a standard `input` event (with `bubbles: true`).
3. If the input is not the active element anymore, dispatches a `change`
   event as well.
4. Maintains the `empty` CSS class:
   - If the value is empty, the `empty` class is added.
   - If the value is not empty, the `empty` class is removed.

You can therefore rely on standard `input` / `change` events and on the
presence of the `empty` class to react to user changes, without having to
listen to internal events.

## Typical use cases

Here are some common scenarios where `@itrocks/autocomplete` is useful:

- **Selecting a customer, supplier or product** by name while submitting the
  underlying numeric id in a form.
- **Country, city or postal code selection** in address forms.
- **Filtering long lists** (e.g. employees, projects, tags) where the user
  only remembers the beginning of the name.
- **Replacing `<select>` elements with thousands of options** by a lightweight
  autocomplete text field backed by a server-side search route.
- **Back-office search fields** such as "assigned to", "linked ticket" or
  "parent entity" selectors.
