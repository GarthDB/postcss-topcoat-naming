import postcss from 'postcss';
import test from 'ava';
import TopcoatNaming from '../src/index';
import {_outdent} from '../src/topcoat-naming.js';

function runTopcoatNaming(input, opts) {
  return postcss([
    TopcoatNaming(opts),
  ]).process(input);
}

test('Collapse state', (t) => {
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
  @state :disabled {
    opacity: 0.1;
  }
  @modifier secondary {
    color: #666;
  }
}`;
  const expected =
  `.Button--secondary {
  color: #333;
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
  color: #333;
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
  color: #333;
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
  color: #333;
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
  color: #333;
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

test('Add nonexistent modifier', (t) => {
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
  `.Button--tertiary {
  color: #333;
}
.Button--tertiary:disabled, .Button--tertiary.is-disabled {
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
  color: #333;
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
