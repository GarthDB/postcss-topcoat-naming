import postcss from 'postcss';
import test from 'ava';
import TopcoatNaming from '../src/index';
import fs from 'fs';
import {_outdent} from '../src/topcoat-naming.js';

function customSelectorNaming ({block, element, modifier, state}) {
  const resultAr = [block];
  if(element) resultAr.push(element);
  if (Array.isArray(modifier)) {
    modifier.forEach(mod => {
      resultAr.push(mod);
    });
  } else if (modifier) {
    resultAr.push(modifier);
  }
  let result = '.';
  result += resultAr.map((part) => {
    return part.replace(/\b\w/g, l => l.toUpperCase());
  }).join('');
  if(state) {
    const stateRegex = /^:?(\w+)$/;
    const matches = state.match(stateRegex);
    const cleanStateName = matches[1];
    // has colon for dom states (i.e. :disabled)
    if((matches[1] != matches[0])) {
      result += `${state}, ${result}__${cleanStateName}`;
    } else {
      result += `__${cleanStateName}`;
    }
  }
  return result;
}

function runTopcoatNaming(input, opts) {
  return postcss([
    TopcoatNaming(opts),
  ]).process(input, {from: undefined});
}

test('Collapse block', (t) => {
  const input =
  `@block Button {
  color: #333;
}`;
  const expected =
  `.Button {
  color: #333;
}`;
  return runTopcoatNaming(input)
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Collapse state', (t) => {
  const input =
  `@block Button {
  color: #333;
  @state :disabled {
    opacity: 0.1;
  }
}`;
  const expected =
  `.Button {
  color: #333;
}
.Button:disabled, .Button.is-disabled {
  opacity: 0.1;
}`;
  return runTopcoatNaming(input)
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Collapse modifier', (t) => {
  const input =
  `@block Button {
  color: #333;
  @modifier secondary {
    color: #666;
  }
}`;
  const expected =
  `.Button--secondary {
  color: #666;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});
test('Collapse modifier and state', (t) => {
  const input =
  `@block Button {
  color: #333;
  @state :disabled {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
  }
}`;
  const expected =
  `.Button--secondary {
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Collapse modifier with state', (t) => {
  const input =
  `@block Button {
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
}`;
  const expected =
  `.Button--secondary {
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
  outline: none;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Collapse modifier with state in other order', (t) => {
  const input =
  `@block Button {
  color: #333;
  @state :disabled {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
    @state :disabled {
      outline: none;
    }
  }
}`;
  const expected =
  `.Button--secondary {
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
  outline: none;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Collapse modifier with new state', (t) => {
  const input =
  `@block Button {
  color: #333;
  @state :disabled {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
    @state :hover {
      outline: none;
    }
  }
}`;
  const expected =
  `.Button--secondary {
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
}
.Button--secondary:hover, .Button--secondary.is-hover {
  outline: none;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});
test('Collapse modifier with new state in different order', (t) => {
  const input =
  `@block Button {
  color: #333;
  @modifier secondary {
    color: #666;
    @state :hover {
      outline: none;
    }
  }
  @state :disabled {
    opacity: 0.1;
  }
}`;
  const expected =
  `.Button--secondary {
  color: #666;
}
.Button--secondary:disabled, .Button--secondary.is-disabled {
  opacity: 0.1;
}
.Button--secondary:hover, .Button--secondary.is-hover {
  outline: none;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Ignore nonexistent modifier', (t) => {
  const input =
  `@block Button {
  color: #333;
  @state :disabled {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
    @state :disabled {
      outline: none;
    }
  }
}`;
  const expected =
  `.Button {
  color: #333;
}
.Button:disabled, .Button.is-disabled {
  opacity: 0.1;
}`;
  return runTopcoatNaming(input, {modifier: 'tertiary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Add non-DOM state', (t) => {
  const input =
  `@block menu {
  color: #333;
  @state open {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
  }
}`;
  const expected =
  `.menu--secondary {
  color: #666;
}
.menu--secondary.is-open {
  opacity: 0.1;
}`;
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Outdent function', (t) => {
  const input =
  `.ding {
      background: orange;
      color: green;
    }`;
  const expected =
  `.ding {
  background: orange;
  color: green;
}`;
  const result = _outdent(postcss.parse(input), 2);
  t.is(result.toString(), expected);
});

test('Simple Topdoc collapsing', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-simple.css', 'utf8');
  const expected = fs.readFileSync('./test/expected/topdoc-simple.css', 'utf8');
  return runTopcoatNaming(input, {})
    .then((result) => {
      t.deepEqual(result.css, expected);
    });
});

test('Modifier Topdoc collapsing', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-simple.css', 'utf8');
  const expected = fs.readFileSync('./test/expected/topdoc-modifier.css', 'utf8');
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css, expected);
    });
});

test('Custom Selector Name Function', (t) => {
  const input =
  `@block Button {
  color: #333;
  @modifier secondary {
    color: #666;
    @state :hover {
      outline: none;
    }
  }
  @state :disabled {
    opacity: 0.1;
  }
}`;
  const expected =
  `.ButtonSecondary {
  color: #666;
}
.ButtonSecondary:disabled, .ButtonSecondary__disabled {
  opacity: 0.1;
}
.ButtonSecondary:hover, .ButtonSecondary__hover {
  outline: none;
}`;
  const opts = {
    modifier: 'secondary',
    selectorNaming: customSelectorNaming
  }
  return runTopcoatNaming(input, opts)
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});

test('Custom Markup Class Name Function', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-simple.css', 'utf8');
  const expected = `/* topdoc
name: Secondary Button
description: a secondary button
markup: |
  <button class="ButtonSecondary"/>
  <button class="ButtonSecondary__disabled"/>
*/
.ButtonSecondary {
  color: #666;
}
.ButtonSecondary:disabled, .ButtonSecondary__disabled {
  opacity: 0.1;
}
`;
  const opts = {
    modifier: 'secondary',
    selectorNaming: customSelectorNaming,
    domNaming: function({block, element, modifier, state}) {
      const resultAr = [block];
      if(element) resultAr.push(element);
      if (Array.isArray(modifier)) {
        modifier.forEach(mod => {
          resultAr.push(mod);
        });
      } else if (modifier) {
        resultAr.push(modifier);
      }
      let result = resultAr.map((part) => {
        return part.replace(/\b\w/g, l => l.toUpperCase());
      }).join('');
      if(state) {
        const stateRegex = /^:?(\w+)$/;
        const matches = state.match(stateRegex);
        const cleanStateName = matches[1];
        result += `__${cleanStateName}`;
      }
      return result;
    }
  };
  return runTopcoatNaming(input, opts)
    .then((result) => {
      t.deepEqual(result.css, expected);
    });
});

test('Collect modifiers', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-multiple-modifiers.css', 'utf8');
  const expected = ['secondary', 'cta'];
  return runTopcoatNaming(input, {})
    .then((result) => {
      t.deepEqual(result.modifiers, expected);
    });
});

test('Modifier second Topdoc collapsing', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-multiple-modifiers.css', 'utf8');
  const expected = fs.readFileSync('./test/expected/topdoc-cta-modifier.css', 'utf8');
  return runTopcoatNaming(input, {modifier: 'cta'})
    .then((result) => {
      t.deepEqual(result.css, expected);
    });
});
test('Modifier second Topdoc collapsing in different order', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-multiple-modifiers.css', 'utf8');
  const expected = fs.readFileSync('./test/expected/topdoc-modifier.css', 'utf8');
  return runTopcoatNaming(input, {modifier: 'secondary'})
    .then((result) => {
      t.deepEqual(result.css, expected);
    });
});
test('Collapsing 3 modifiers', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-toomany-modifiers.css', 'utf8');
  const expected = `/* topdoc
name: Secondary Button
description: a secondary button
markup: |
  <button class="Button--secondary--large--dark"/>
  <button class="Button--secondary--large--dark is-disabled"/>
*/
.Button--secondary--large--dark {
  color: black;
  width: 200px;
}
.Button--secondary--large--dark:disabled, .Button--secondary--large--dark.is-disabled {
  opacity: 0.1;
}`;
  return runTopcoatNaming(input, {modifiers: ['secondary', 'large', 'dark']})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});
test('Collapsing 3 modifiers in different order', (t) => {
  const input = fs.readFileSync('./test/fixtures/topdoc-toomany-modifiers.css', 'utf8');
  const expected = `/* topdoc
name: Secondary Button
description: a secondary button
markup: |
  <button class="Button--large--dark--secondary"/>
  <button class="Button--large--dark--secondary is-disabled"/>
*/
.Button--large--dark--secondary {
  color: #666;
  width: 200px;
}
.Button--large--dark--secondary:disabled, .Button--large--dark--secondary.is-disabled {
  opacity: 0.1;
}`;
  return runTopcoatNaming(input, {modifiers: ['large', 'dark', 'secondary']})
    .then((result) => {
      t.deepEqual(result.css.trim(), expected);
    });
});
