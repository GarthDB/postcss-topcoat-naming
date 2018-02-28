import postcss from 'postcss';
import Mustache from 'mustache';
import TopdocParser from 'postcss-topdoc/lib/topdoc-parser';
import yaml from 'js-yaml';

function _defaultSelectorClassNaming({
  block,
  modifier = false,
  state = false
}) {
  let result = `.${block}`;
  if (Array.isArray(modifier)) {
    modifier.forEach(mod => {
      result += `--${mod}`;
    });
  } else if (modifier) {
    result += `--${modifier}`;
  }
  if (state) {
    const stateRegex = /^:?(\w+)$/;
    const matches = state.match(stateRegex);
    const cleanStateName = matches[1];
    // has colon for dom states (i.e. :disabled)
    if ((matches[1] != matches[0])) {
      result += `${state}, ${result}.is-${cleanStateName}`;
    } else {
      result += `.is-${cleanStateName}`;
    }
  }
  return result;
}

function _defaultDomClassNaming({
  block,
  modifier = false,
  state = false
}) {
  let result = `${block}`;
  if (Array.isArray(modifier)) {
    modifier.forEach(mod => {
      result += `--${mod}`;
    });
  } else if (modifier) {
    result += `--${modifier}`;
  }
  if (state) {
    const stateRegex = /^:?(\w+)$/;
    const matches = state.match(stateRegex);
    const cleanStateName = matches[1];
    result += ` is-${cleanStateName}`;
  }
  return result;
}

function _getAtRuleBreakdown(node, breakdown = {}) {
  if (node.type === 'atrule') {
    switch (node.name) {
      case 'block':
        breakdown.block = node.params;
        break;
      case 'modifier':
        breakdown.modifier = node.params;
        break;
      case 'state':
        breakdown.state = node.params;
        break;
    }
  } else if (node.type === 'root') {
    return breakdown;
  }
  return _getAtRuleBreakdown(node.parent, breakdown);
}

function _mergeRules(existingRule, newDecls) {
  const decls = (Array.isArray(newDecls)) ? newDecls : [newDecls];
  decls.forEach(newDecl => {
    let matched = false;
    existingRule.each(decl => {
      if (decl.type === 'decl') {
        if (decl.prop === newDecl.prop) {
          matched = true;
          decl.value = newDecl.value;
        }
      }
    });
    if (!matched) {
      existingRule.append(newDecl);
    }
  });
  return existingRule;
}

function _getCorrespondingTopdocComponent(topdoc, node) {
  if (!node.prev()) return false;
  const loc = node.prev().source.end;
  return topdoc.components.find((component) => {
    return (component.commentEnd.line == loc.line && component.commentEnd.column == loc.column);
  });
}

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
    if (child.raws.after) {
      child.raws.after = child.raws.after.replace(regex, '')
    }
    child.raws.before = child.raws.before.replace(regex, '')
  });
  if (rule.raws.after) {
    rule.raws.after = rule.raws.after.replace(regex, '')
  }
  if (rule.raws.before) {
    rule.raws.before = rule.raws.before.replace(regex, '')
  }
  return rule;
}

export default class TopcoatNaming {
  constructor(css, result, opts) {
    this.opts = opts;
    this.css = css;
    this.result = result;
    this.result.modifiers = [];
    this.opts.selectorNaming = this.opts.selectorNaming || _defaultSelectorClassNaming;
    this.opts.modifiers = this.opts.modifiers || [this.opts.modifier];
    this.opts.domNaming = this.opts.domNaming || _defaultDomClassNaming;
    const topdocParser = new TopdocParser(css, result, {});
    this.topdoc = topdocParser.topdoc;
    this.process();

    // this.css.walkAtRules('block', (rule) => this.processBlockRule(rule));
  }
  process() {
    this.css.each(node => {
      if (node.type === 'atrule') {
        this.processAtRule(node);
      }
    });
  }
  processAtRule(atRule) {
    switch (atRule.name) {
      case 'block':
        this.processBlockRule(atRule);
        break;
      case 'state':
      case 'modifier':
      case 'element':
        _outdent(atRule);
        const newPart = {
          breakdown: _getAtRuleBreakdown(atRule),
          atRule: atRule.clone()
        };
        this.nestedParts.push(newPart);
        if (newPart.breakdown.hasOwnProperty('modifier') && this.opts.modifiers.indexOf(newPart.breakdown.modifier) >= 0 && this.matchedModifiers.indexOf(newPart.breakdown.modifier) == -1) {
          this.matchedModifiers.push(newPart.breakdown.modifier);
        }
        if (atRule.name === 'modifier') {
          this.result.modifiers.push(atRule.params);
          const modifierTopdocs = _getCorrespondingTopdocComponent(this.topdoc, atRule);
          if(modifierTopdocs){
            this.modifierTopdocs[atRule.params] = modifierTopdocs;
            atRule.prev().remove();
          }
        }
        atRule.remove();
        break;
    }
  }
  processBlockRule(blockRule) {
    this.modifierTopdocs = {};
    this.nestedParts = [];
    this.matchedModifiers = [];
    this.stateRules = {};
    blockRule.each(node => {
      if (node.type === 'atrule') {
        this.processAtRule(node);
      }
    });
    this.matchedModifiers = this.opts.modifiers.filter(modifier => {
      return (this.matchedModifiers.indexOf(modifier) >= 0);
    });
    this.processNestedParts(this.nestedParts, blockRule);
    this.processTopdocComments(blockRule);
    const blockRuleSelector = this.opts.selectorNaming(_getAtRuleBreakdown(blockRule, {
      modifier: this.matchedModifiers
    }));
    return blockRule.replaceWith(_convertAtRuleToRule(blockRule, blockRuleSelector));
  }
  processNestedParts(nestedParts, blockRule) {
    nestedParts.forEach(part => {
      if (!part.breakdown.hasOwnProperty('modifier') || part.breakdown.modifier == '') {
        switch (part.atRule.name) {
          case 'state':
            this.processStateRule(part.atRule, blockRule)
            break;
        }
      }
    });
    this.opts.modifiers.forEach(modifier => {
      nestedParts.forEach(part => {
        if (part.breakdown.hasOwnProperty('modifier') && part.breakdown.modifier === modifier) {
          switch (part.atRule.name) {
            case 'modifier':
              this.processModifierRule(part.atRule, blockRule);
              break;
            case 'state':
              this.processStateRule(part.atRule, blockRule)
              break;
          }
        }
      });
    });
  }
  processStateRule(stateRule, blockRule) {
    const stateRuleSelector = this.opts.selectorNaming({
      block: blockRule.params,
      modifier: this.matchedModifiers,
      state: stateRule.params
    });
    if (this.stateRules.hasOwnProperty(stateRuleSelector)) {
      _mergeRules(this.stateRules[stateRuleSelector], stateRule.nodes);
      stateRule.remove();
      return this.stateRules[stateRuleSelector];
    } else {
      const beforeNode = ((Object.keys(this.stateRules).length == 0)) ? blockRule : Object.values(this.stateRules)[Object.values(this.stateRules).length - 1];
      const result = beforeNode.cloneAfter(_convertAtRuleToRule(stateRule, stateRuleSelector));
      result.stateName = stateRule.params;
      this.stateRules[stateRuleSelector] = result;
      stateRule.remove();
      return result;
    }
  }
  processModifierRule(modifierRule, blockRule) {
    modifierRule.each(node => {
      if (node.type === 'atrule') {
        switch (node.name) {
          case 'state':
            _outdent(node);
            this.processStateRule(node, blockRule);
            break;
        }
      }
    });
    return _mergeRules(blockRule, modifierRule.nodes);
  }
  processTopdocComments(blockRule) {
    const topComponent = _getCorrespondingTopdocComponent(this.topdoc, blockRule);
    if (topComponent) {
      this.matchedModifiers.forEach(modifier => {
        Object.assign(topComponent, this.modifierTopdocs[modifier]);
      });
      const stateNames = [{
        blockName: this.opts.domNaming({
          block: blockRule.params,
          modifier: this.matchedModifiers
        })
      }];

      Object.values(this.stateRules).forEach(state => {
        stateNames.push({
          blockName: this.opts.domNaming({
            block: blockRule.params,
            modifier: this.matchedModifiers,
            state: state.stateName
          })
        });
      });
      const cleanComponent = Object.keys(topComponent).reduce((component, componentKey) => {
        if (componentKey === 'markup') {
          component[componentKey] = Mustache.render(topComponent.markup, {
            state: stateNames
          });
        } else if (componentKey !== 'commentStart' && componentKey !== 'commentEnd' && componentKey !== 'css') {
          component[componentKey] = topComponent[componentKey];
        }
        return component
      }, {});
      // console.log(cleanComponent);
      const yamlString = yaml.safeDump(cleanComponent);
      const newComment = postcss.parse(`/* topdoc
${yamlString.trim()}
*/`);
      return blockRule.prev().replaceWith(newComment.first);
    }
  }
}
