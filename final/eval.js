const acorn = require("acorn");

class Scope {
  constructor(initial /* 初始化变量 */, parent) {
    // 初始化变量
    this.variables = initial || {};
    // 父级作用域
    this.parent = parent;
    // 子级作用域
    this.childScopes = [];

    // 作用域 "function" | "block" 
    this.type = "block";


    // 当前作用域存在父级作用域时给父级作用域注册子级作用域
    if (parent) {
      parent.childScopes.push(this);
    }
  }

  get(name) {
    if (this.variables[name]) {
      return this.variables[name];
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    return undefined;
  }

  set(name, value) {
    if (this.type === "const") {
      throw new Error("Can't reassign const");
    }
    this.variables[name] = value;
  }

  declare(value, type) {
    // 值的类型 type: "const" | "let" | "var"
    return       
  }
}

function evaluate(node, scope) {
  switch (node.type) {
    // 字面量
    case "Literal":
      return node.value;

    // 变量 从作用域中读取变量名对应的字面量
    case "Identifier":
      return scope.get(node.name);

    //
    case "RegExpLiteral":
      return;

    //
    case "Program":
      let arr = node.body.map((n) => evaluate(n, scope));
      return arr.length ? arr[arr.length - 1] : undefined;

    // 声明语句 变量声明
    case "ExpressionStatement": {
      return evaluate(node.expression, scope);
    }

    // 块语句 (代码块)
    case "BlockStatement": {
      let ret;
      for (const expression of node.body) {
        ret = evaluate(expression, scope);
        if (ret instanceof BlockInterruption) return ret;
      }
      return ret;
    }

    // 空语句 (;)
    case "EmptyStatement":
      throw new Error("Uncaught SyntaxError: Unexpected token ';'");

    // 调试语句 (debugger)
    case "DebuggerStatement":
      throw new Error("Uncaught SyntaxError: Unexpected token 'debugger'");

    // 赋值 ( = , += , -= , *= , /= , %= , <<= , >>= , >>>= , &= , ^= , |= )
    case "AssignmentExpression": {
      let rightValue = evaluate(node.right, scope);
      if (node.left.type === "Identifier") {
        let leftValue = evaluate(node.left, scope);
        switch (node.operator) {
          case "=":
            scope.set(node.left.name, rightValue);
            break;
          case "+=":
            scope.set(node.left.name, leftValue + rightValue);
            break;
          case "-=":
            scope.set(node.left.name, leftValue - rightValue);
            break;
          case "/=":
            scope.set(node.left.name, leftValue / rightValue);
            break;
          case "*=":
            scope.set(node.left.name, leftValue * rightValue);
            break;
          case "%=":
            scope.set(node.left.name, leftValue % rightValue);
            break;
          case "<<=":
            scope.set(node.left.name, leftValue << rightValue);
            break;
          case ">>=":
            scope.set(node.left.name, leftValue >> rightValue);
            break;
          case ">>>=":
            scope.set(node.left.name, leftValue >>> rightValue);
            break;
          case "|=":
            scope.set(node.left.name, leftValue | rightValue);
            break;
          case "^=":
            scope.set(node.left.name, leftValue ^ rightValue);
            break;
          case "&=":
            scope.set(node.left.name, leftValue & rightValue);
            break;
        }
        return scope.get(node.left.name);
      } else if (node.left.type === "MemberExpression") {
        // 给对象的内部属性赋值
        let [leftObj, leftPropName] = evaluate(node.left, scope, {
          setObjPropVal: true,
        });
        let leftValue = leftObj[leftPropName];
        switch (node.operator) {
          case "=":
            leftObj[leftPropName] = rightValue;
            break;
          case "+=":
            leftObj[leftPropName] = leftValue + rightValue;
            break;
          case "-=":
            leftObj[leftPropName] = leftValue - rightValue;
            break;
          case "/=":
            leftObj[leftPropName] = leftValue / rightValue;
            break;
          case "*=":
            leftObj[leftPropName] = leftValue * rightValue;
            break;
          case "%=":
            leftObj[leftPropName] = leftValue % rightValue;
            break;
          case "<<=":
            leftObj[leftPropName] = leftValue << rightValue;
            break;
          case ">>=":
            leftObj[leftPropName] = leftValue >> rightValue;
            break;
          case ">>>=":
            leftObj[leftPropName] = leftValue >>> rightValue;
            break;
          case "|=":
            leftObj[leftPropName] = leftValue | rightValue;
            break;
          case "^=":
            leftObj[leftPropName] = leftValue ^ rightValue;
            break;
          case "&=":
            leftObj[leftPropName] = leftValue & rightValue;
            break;
        }
        return leftObj[leftPropName];
      }
    }

    // 函数调用 声明函数 + 处理参数
    case "FunctionDeclaration": {
      // 声明函数
      return scope.declare("var", node.id.name, function (...args) {
        // 创建新的函数作用域
        const nodeScope = new Scope("function", scope);
        // 处理函数参数
        node.params.forEach((param, i) => {
          nodeScope.declare("let", param.name, args[i]);
        });
        return evaluate(node.body, nodeScope);
      });
    }
    // 变量声明
    case "VariableDeclaration": {
      return node.declarations.forEach((v) => {
        if (
          v.init &&
          v.init.type === "FunctionExpression" &&
          v.init.id === null
        ) {
          // 未给普通函数声明又未将之赋给变量
          throw new SyntaxError("Function statements require a function name");
        }
        return scope.declare(node.kind, v.id.name, evaluate(v.init, scope));
      });
    }

    // If 语句 test ? consequent : alternate
    case "IfStatement": {
      return evaluate(node.test, scope)
        ? evaluate(node.consequent, scope)
        : evaluate(node.alternate, scope);
    }

    // Switch 语句
    case "SwitchStatement": {
      let ret;
      node.cases.forEach((c) => {
        if (
          c.test !== null &&
          !(evaluate(c.test, scope) === evaluate(node.discriminant, scope))
        )
          return ret;
        c.consequent.forEach((e) => {
          if (e.type === "BlockStatement") {
            ret = evaluate(e, new Scope("block", scope));
          } else {
            ret = evaluate(e, scope);
          }
        });
      });
      return ret;
    }

    // continue 语句
    case "ContinueStatement": {
      let continuation = new BlockInterruption("continue");
      if (node.label) continuation.setLabel(node.label.name);
      return continuation;
    }

    // break 语句
    case "BreakStatement": {
      let breaker = new BlockInterruption("break");
      if (node.label) breaker.setLabel(node.label.name);
      return breaker;
    }

    // while 语句
    case "WhileStatement": {
      let ret;
      let label = config ? config.label : undefined;
      const whileScope = new Scope("block", scope);
      while (evaluate(node.test, whileScope)) {
        const whileInnerScope = new Scope("block", whileScope);
        ret = evaluate(node.body, whileInnerScope);
        if (ret instanceof BlockInterruption && ret.getType() === "continue") {
          if (ret.getLabel() === undefined || ret.getLabel() === label) {
            continue;
          } else return ret;
        }
        if (ret instanceof BlockInterruption && ret.getType() === "break") {
          if (ret.getLabel() === undefined || ret.getLabel() === label) {
            return;
          } else return ret;
        }
        if (ret instanceof BlockInterruption && ret.getType() === "return")
          return ret;
      }
      return;
    }

    // for语句
    case "ForStatement": {
      let ret;
      let label = config ? config.label : undefined;
      // 包括定义索引等的定义域
      const forScope = new Scope("block", scope);
      for (
        evaluate(node.init, forScope);
        evaluate(node.test, forScope);
        evaluate(node.update, forScope)
      ) {
        // 每次循环内产生内作用域
        const forInnerScope = new Scope("block", forScope);
        // 运行while内代码
        ret = evaluate(node.body, forInnerScope);
        // continue
        if (ret instanceof BlockInterruption && ret.getType() === "continue") {
          // 无label或指定当前label 跳过当前while本次循环
          if (ret.getLabel() === undefined || ret.getLabel() === label) {
            continue;
          }
          // label不匹配 向上一级作用域抛
          else return ret;
        }
        // break
        if (ret instanceof BlockInterruption && ret.getType() === "break") {
          if (ret.getLabel() === undefined || ret.getLabel() === label) {
            return;
          } else return ret;
        }
        // return
        if (ret instanceof BlockInterruption && ret.getType() === "return")
          return ret;
      }
      return;
    }

    case "LabeledStatement": {
      return evaluate(node.body, scope, {
        label: node.label.name,
      });
    }

    // 逻辑运算符
    case "LogicalExpression": {
      switch (node.operator) {
        case "&&":
          return evaluate(node.left, scope) && evaluate(node.right, scope);
        case "||":
          return evaluate(node.left, scope) || evaluate(node.right, scope);
      }
    }

    // 表达式

    // 基本运算符
    case "BinaryExpression": {
      const left = evaluate(node.left, scope);
      const right = evaluate(node.right, scope);
      switch (node.operator) {
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case "===":
          return left === right;
        case "!==":
          return left !== right;
        case "<":
          return left < right;
        case "<=":
          return left <= right;
        case ">":
          return left > right;
        case ">=":
          return left >= right;
        case "<<":
          return left << right;
        case ">>":
          return left >> right;
        case ">>>":
          return left >>> right;
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
        case "%":
          return left % right;
        case "|":
          return left | right;
        case "^":
          return left ^ right;
        case "&":
          return left & right;
        case "in":
          return left in right;
        case "instanceof":
          return left instanceof right;
      }
    }

    case "UnaryExpression": {
      switch (node.operator) {
        case "-":
          return -evaluate(node.argument, scope);
        case "+":
          return +evaluate(node.argument, scope);
        case "!":
          return !evaluate(node.argument, scope);
        case "~":
          return ~evaluate(node.argument, scope);
        case "typeof":
          return typeof evaluate(node.argument, scope);
      }
    }
    // ++ 和 --
    case "UpdateExpression": {
      let preValue = evaluate(node.argument, scope);
      if (node.argument.type === "MemberExpression") {
        let [obj, objPropName] = evaluate(node.argument, scope, {
          setObjPropVal: true,
        });
        if (node.operator === "++") {
          return node.prefix ? ++obj[objPropName] : obj[objPropName]++;
        } else {
          return node.prefix ? --obj[objPropName] : obj[objPropName]--;
        }
      } else {
        // node.argument.type === 'Indentifier'
        if (node.operator === "++") {
          scope.set(node.argument.name, preValue + 1);
          return node.prefix ? preValue + 1 : preValue;
        } else {
          scope.set(node.argument.name, preValue - 1);
          return node.prefix ? preValue - 1 : preValue;
        }
      }
    }

    // 三目运算符
    case "ConditionalExpression":
      return evaluate(node.test, scope)
        ? evaluate(node.consequent, scope)
        : evaluate(node.alternate, scope);

    //对象
    case "ObjectExpression": {
      let props = node.properties;
      const obj = {};
      props.forEach((p) => {
        obj[p.key.name] = evaluate(p.value, scope);
      });
      return obj;
    }
    case "MemberExpression": {
      // 是否设置属性内部值
      let isSetObjPropVal = config?.setObjPropVal;
      let obj = node.object.name
        ? scope.get(node.object.name)
        : evaluate(node.object, scope);
      let pname = node.computed
        ? evaluate(node.property, scope)
        : node.property.name;
      return isSetObjPropVal ? [obj, pname] : obj[pname];
    }
    // 数组
    case "ArrayExpression": {
      return node.elements.map((e) => e.value) || [];
    }
    // 调用执行函数
    case "CallExpression": {
      let ret = evaluate(
        node.callee,
        scope
      )(...node.arguments.map((arg) => evaluate(arg, scope)));
      return ret instanceof BlockInterruption ? ret.value : ret;
    }
    // 普通函数
    case "FunctionExpression": {
      return function (...args) {
        const funScope = new Scope("function", scope);
        node.params.forEach((param, i) => {
          funScope.declare("let", param.name, args[i]);
        });
        return evaluate(node.body, funScope);
      };
    }
    // 箭头函数
    case "ArrowFunctionExpression": {
      return function (...args) {
        const funScope = new Scope("function", scope);
        node.params.forEach((param, i) => {
          funScope.declare("let", param.name, args[i]);
        });
        return evaluate(node.body, funScope);
      };
    }
    // try
    case "TryStatement": {
      try {
        const tryScope = new Scope("block", scope);
        evaluate(node.block, tryScope);
      } catch (err) {
        const catchScope = new Scope("block", scope);
        catchScope.declare("let", node.handler.param.name, err);
        return evaluate(node.handler.body, catchScope);
      } finally {
        const finallyScope = new Scope("block", scope);
        evaluate(node.finalizer, finallyScope);
      }
    }
    // throw
    case "ThrowStatement": {
      throw evaluate(node.argument, scope);
    }
    case "EmptyStatement":
      return;
    case "SequenceExpression": {
      let arr = node.expressions.map((e) => evaluate(e, scope));
      return arr[arr.length - 1];
    }
    // return
    case "ReturnStatement": {
      return new BlockInterruption("return", evaluate(node.argument, scope));
    }
  }

  throw new Error(
    `Unsupported Syntax ${node.type} at Location ${node.start}:${node.end}`
  );
}

function customEval(code, parent) {
  const scope = new Scope(
    {
      module: {
        exports: {},
      },
    },
    parent
  );

  const node = acorn.parse(code, {
    ecmaVersion: 6,
  });
  evaluate(node, scope);

  return scope.get("module").exports;
}

module.exports = {
  customEval,
  Scope,
};
