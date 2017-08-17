import postcss from 'postcss';

function _convertAtRuleToRule(atRule, selector) {
  const root = postcss.parse(`${selector}{}`);
  root.first.raws = atRule.raws;
  root.first.nodes = atRule.nodes;
  root.first.raws.semicolon = true;
  return root.first.remove();
}
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

function _buildClassName(className, modifier = '') {
  if(modifier !== '') {
    return `.${className}--${modifier}`;
  }
  return `.${className}`;
}

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

function _processStateRule(stateRule, parentClass) {
  const newSelector = postcss.parse(_buildStateClassName(parentClass, stateRule.params));
  return _convertAtRuleToRule(stateRule, newSelector);
}

export default class TopcoatNaming {
  constructor(css, opts) {
    this.opts = opts;
    this.css = css;
    this.css.walkAtRules('block', (rule) => this.processBlockRule(rule));
  }
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
