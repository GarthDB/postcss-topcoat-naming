import postcss from 'postcss';

/**
 *  Private: converts {AtRule} and child nodes to a {Rule} with a new selector.
 *
 *  * `atRule` {AtRule} postcss at rule
 *  * `selector` {String} css selector
 *
 *  Returns {Rule} with all the AtRule child nodes.
 */
function _convertAtRuleToRule(atRule, selector) {
  const root = postcss.parse(`${selector}{}`);
  root.first.raws = atRule.raws;
  root.first.nodes = atRule.nodes;
  root.first.raws.semicolon = true;
  return root.first.remove();
}
/**
 *  Private: outdents rule (moves an indented rule out)
 *
 *  * `rule` {Rule} or {AtRule} that needs to be outdented
 *  * `degree` (optional) {Int} Number of indents to be removed.
 *
 *  Returns the same {Rule} with the outdents applied.
 */
export function _outdent(rule, degree = 1) {
  const regex = new RegExp(`(  |\t){${degree}}`);
  rule.walk((child) => {
    if(child.raws.after) {
      child.raws.after = child.raws.after.replace(regex, '')
    }
    child.raws.before = child.raws.before.replace(regex, '')
  });
  if(rule.raws.after) {
    rule.raws.after = rule.raws.after.replace(regex, '')
  }
  if(rule.raws.before) {
    rule.raws.before = rule.raws.before.replace(regex, '')
  }
  return rule;
}

/**
 *  Private: takes a class name and modifier to build new class name for css selector.
 *
 *  * `className` {String} the block name
 *  * `modifier` (optional) {String} the modifier to append if present
 *
 *  Returns a {String} of the built class name (with prepended .)
 */
function _buildClassName(className, modifier = '') {
  if(modifier !== '') {
    return `.${className}--${modifier}`;
  }
  return `.${className}`;
}

/**
 *  Private: adds state to class name
 *
 *  * `className` {String} name to append the state.
 *  * `stateName` {String} state name to be appended to class.
 *
 *  ## Examples
 *
 *  ```js
 *  _buildStateClassName('.button', ':hover');
 *  //returns '.button:hover, .button.is-hover'
 *  ```
 *
 *  ```js
 *  _buildStateClassName('.menu', 'open');
 *  //returns '.menu.is-open'
 *  ```
 *
 *  Returns a {String} of the complete selector
 */
function _buildStateClassName(className, stateName) {
  const stateRegex = /^:?(\w+)$/;
  const matches = stateName.match(stateRegex);
  const newStateName = matches[1];
  // has colon for dom states (i.e. :disabled)
  if((matches[1] != matches[0])) {
    return `${className}:${newStateName}, ${className}.is-${newStateName}{}`;
  }
  return `${className}.is-${newStateName}{}`;
}
/**
 *  Private: converts state {AtRule} into a {Rule} with correct classname and state selector.
 *
 *  * `stateRule` {AtRule} (i.e. @state :hover {})
 *  * `parentClass` {String} class name of block parent
 *
 *  Returns {Rule}
 */
function _processStateRule(stateRule, parentClass) {
  const newSelector = postcss.parse(_buildStateClassName(parentClass, stateRule.params));
  return _convertAtRuleToRule(stateRule, newSelector);
}

export default class TopcoatNaming {
  /**
   *  Public: TopcoatNaming constructor
   *
   *  * `css` {Root} from PostCSS parser
   *  * `opts` {Object} options
   *
   *  ## Examples
   *
   *  ```js
   *  export default postcss.plugin('postcss-topcoat-naming',
   *    (opts = {}) =>
   *      (css) =>
   *        new TopcoatNaming(css, opts)
   *  );
   *  ```
   */
  constructor(css, opts) {
    this.opts = opts;
    this.css = css;
    this.css.walkAtRules('block', (rule) => this.processBlockRule(rule));
  }
  /**
   *  Private: processes block {AtRule}
   *
   *  * `atRule` {AtRule} with a name of 'block';
   */
  processBlockRule (atRule) {
    const newClassName = _buildClassName(atRule.params, this.opts.modifier);
    const newBlockClass = _convertAtRuleToRule(atRule, `${newClassName}{}`);
    atRule.replaceWith(newBlockClass);
    newBlockClass.walkAtRules('modifier', (modifierAtRule) => {
      if(modifierAtRule.params === this.opts.modifier) {
        _outdent(modifierAtRule);
        modifierAtRule.each((childNode) => {
          if(childNode.type === 'atrule' && childNode.name === 'state') {
            let matchFlag = false;
            newBlockClass.walkAtRules('state', (stateAtRule) => {
              if(stateAtRule.parent === atRule) {
                if(stateAtRule.params === childNode.params) {
                  childNode.each((grandChildNode) => {
                    stateAtRule.append(grandChildNode);
                    matchFlag = true;
                  });
                }
              }
            });
            if(!matchFlag){
              newBlockClass.prepend(childNode);
            }
          } else {
            newBlockClass.append(childNode);
          }
        });
      }
      modifierAtRule.remove();
    });
    newBlockClass.walkAtRules('state', (subAtRule) => {
      _outdent(newBlockClass.cloneAfter(_processStateRule(subAtRule, newClassName)));
      subAtRule.remove();
    });
  }
}
