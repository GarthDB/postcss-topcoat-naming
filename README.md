# postcss-topcomponent

[![Build Status](https://travis-ci.org/GarthDB/postcss-topcomponent.svg?branch=master)](https://travis-ci.org/GarthDB/postcss-topcomponent) [![codecov](https://codecov.io/gh/GarthDB/postcss-topcomponent/branch/master/graph/badge.svg)](https://codecov.io/gh/GarthDB/postcss-topcomponent) [![Dependency Status](https://david-dm.org/GarthDB/postcss-topcomponent.svg)](https://david-dm.org/GarthDB/postcss-topcomponent) [![npm version](https://badge.fury.io/js/postcss-topcomponent.svg)](https://badge.fury.io/js/postcss-topcomponent)

---

<a href="http://postcss.org/"><img align="right" width="95" height="95"
     title="Philosopher’s stone, logo of PostCSS"
     src="http://postcss.github.io/postcss/logo.svg"></a>

A PostCSS plugin to collapse BEM @rules and corresponding Topdoc comments

## Examples

```css
/* topdoc
name: Button
description: a simple button
markup: |
  {{#state}}<button class="{{ blockName }}"/>
  {{/state}}
*/
@block Button {
  color: #333;
  @state :disabled {
    opacity: 0.1;
  }
  /* topdoc
  name: Secondary Button
  description: a secondary button
  */
  @modifier secondary {
    color: #666;
  }
}
```

is collapsed to this:

```css
/* topdoc
name: Button
description: a simple button
markup: |
  <button class="Button"/>
  <button class="Button is-disabled"/>
*/
.Button {
  color: #333;
}
.Button:disabled, .Button.is-disabled {
  opacity: 0.1;
}
```

and if a modifier is passed through, it is collapsed to this:

```css
/* topdoc
name: Secondary Button
description: a secondary button
markup: |
  <button class="Button--secondary"/>
  <button class="Button--secondary is-disabled"/>
*/
.Button--secondary {
  color: #333;
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
}
```

## Usage

Using it as a PostCSS plugin.

```js
import postcss from 'postcss';
import TopcoatNaming from 'postcss-topcomponent';

postcss([
  TopcoatNaming({modifier: 'secondary'}),
]).process(input);
```

### Option

Options that can be passed to the plugin.

#### ``{modifier}`` (String)

If the `modifier` matches a `@modifier` value, the rules will be combined.

In this example, when the `modifier` value is set to `secondary`:

```css
@block Button {
  color: #333;
  @modifier secondary {
    color: #666;
    @state :disabled {
      outline: none;
    }
  }
  @state :disabled {
    opacity: 0.1;
  }
}
```

The result is:

```css
.Button--secondary {
  color: #333;
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
  outline: none;
}
```

If the provided `modifier` value does not match a modifier in the source css the modifier value is still appended to the class, but the rule is not actually modified.

In this example, when the `modifier` value is set to `tertiary`:

```css
@block Button {
  color: #333;
  @modifier secondary {
    color: #666;
    @state :disabled {
      outline: none;
    }
  }
  @state :disabled {
    opacity: 0.1;
  }
}
```

The result is:

```css
.Button--tertiary {
color: #333;
}
.Button--tertiary:disabled, .Button--tertiary.is-disabled {
opacity: 0.1;
}
```

## Topdoc

Provided Topdoc comments that correspond to `@Block` atRules.

### States

TODO: write

### Modifiers

TODO: write
