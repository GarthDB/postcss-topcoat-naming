import postcss from 'postcss';
import Mustache from 'mustache';
import TopdocParser from 'postcss-topdoc/lib/topdoc-parser';
import yaml from 'js-yaml';

/**
 *  Private: default function for creating CSS selector class names.
 *
 *  * `arguments`
 *    * `block` {String} Block element name
 *    * `modifier` (optional) {String} or {Array} of modifier name(s)
 *    * `state` (optional) {String} state name.
 *
 *  ## Examples
 *
 *  ```js
 *  _defaultSelectorClassNaming({
 *    block: 'Button',
 *    modifier: 'secondary',
 *    state: ':disabled'
 *  }); //returns ".Button--secondary:disabled, .Button--secondary.is-disabled"
 *  ```
 *
 *  Returns {String} CSS selector
 */
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
/**
 *  Private: default function for creating class names for use in Topdoc markup.
 *
 *  * `arguments`
 *    * `block` {String} Block element name
 *    * `modifier` (optional) {String} or {Array} of modifier name(s)
 *    * `state` (optional) {String} state name.
 *
 *  ## Examples
 *
 *  ```js
 *  _defaultDomClassNaming({
 *    block: 'Button',
 *    modifier: 'secondary',
 *    state: ':disabled'
 *  }); //returns "Button--secondary is-disabled"
 *  ```
 *
 *  Returns {String} DOM class name.
 */
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
/**
 *  Private: Using the PostCSS parent tree, this method returns an object of the parent AtRules.
 *
 *  * `node` {Object} PostCSS node
 *  * `breakdown` (optional) {Object} an existing breakdown to include in the final output.
 *
 *  ## Examples
 *
 *  ```js
 *  _getAtRuleBreakdown(stateAtRule, {modifier: 'secondary'});
 *  // returns something like
 *  // {block: 'Button', modifier: 'secondary', state: 'disabled'}
 *  ```
 *
 *  Returns {Object} of AtRule Breakdown
 */
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

/**
 *  Private: merge declarations into an existing rule. If declaration already exists in the existing rule it replaces the exisiting value with the new declaration value.
 *
 *  * `existingRule` {Object} PostCSS node
 *  * `newDecls` {Array} of PostCSS Declarations
 *
 *  Returns {Object} PostCSS node
 */
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
/**
 *  Private: gets a corresponding topdoc comment
 *
 *  * `topdoc` {TopDocument} containing component
 *  * `node` {Object} PostCSS node
 *
 *  Returns {undefined} if no corresponding topdoc component is found.
 *  Returns {TopComponent} if found.
 */
function _getCorrespondingTopdocComponent(topdoc, node) {
  if (!node.prev()) return false;
  const loc = node.prev().source.end;
  return topdoc.components.find((component) => {
    return (component.commentEnd.line == loc.line && component.commentEnd.column == loc.column);
  });
}

/**
 *  Private: coverts PostCSS AtRule to Rule.
 *
 *  * `atRule` {Object} PostCSS AtRule
 *  * `selector` {String} new selector for the returned Rule
 *
 *  Returns {Object} PostCSS Rule
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
  /**
   *  Public: TopcoatNaming constructor
   *
   *  * `css` {Root} from PostCSS parser
   *  * `result` {Result} from PostCSS
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
  }
  /**
   *  Private: processes CSS nodes from `this.css`
   *
   */
  process() {
    this.css.each(node => {
      if (node.type === 'atrule') {
        this.processAtRule(node);
      }
    });
  }
  /**
   *  Private: processes {AtRule}
   *
   *  * `atRule` {AtRule};
   */
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
  /**
   *  Private: processes block {AtRule}
   *
   *  * `blockRule` {AtRule} with a name of 'block'
   */
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
  /**
   *  Private: processes nested {Nodes}
   *
   *  * `nestedParts` {Array} PostCSS nodes
   *  * `blockRule` {Object} PostCSS parent block rule
   */
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
  /**
   *  Private: processes state {AtRule}
   *
   *  * `stateRule` {AtRule} with a name of 'state'
   *  * `blockRule` {AtRule} that contains the `stateRule`
   */
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
  /**
   *  Private: processes modifier {AtRule}
   *
   *  * `modifierRule` {AtRule} with a name of 'modifier'
   *  * `blockRule` {AtRule} that contains the `modifierRule`
   */
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
  /**
   *  Private: merges Topdoc comments when modifier Topdoc data exists
   *
   *  * `blockRule` {AtRule} that has the existing Topdoc comments
   */
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
