"""受限算术求值：只解析 AST 白名单节点，绝不使用 ``eval``。

背景：教学工具 ``calculator`` 曾以「字符集白名单 + eval」实现，但白名单
允许 ``*`` 时，右结合的 ``**``（幂运算）同样由合法字符组成，``9**9**9``
足以耗尽 CPU/内存。这里改为先 ``ast.parse`` 再按节点类型求值，从结构上
排除函数调用、属性访问、下标、幂运算等一切非四则运算节点。
"""

from __future__ import annotations

import ast
import math

_MAX_EXPR_CHARS = 200
_MAX_AST_NODES = 256
_MAX_ABS_VALUE = 1e12
_ALLOWED_CHARS = set("0123456789+-*/()., %")
_ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div)
_ALLOWED_UNARYOPS = (ast.UAdd, ast.USub)


def _check_value(value: object) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("表达式只能包含数字")
    if not math.isfinite(value) or abs(value) > _MAX_ABS_VALUE:
        raise ValueError("表达式中的数值或结果超出允许范围")
    return value


def _eval_node(node: ast.AST) -> int | float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant):
        return _check_value(node.value)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, _ALLOWED_UNARYOPS):
        operand = _eval_node(node.operand)
        return _check_value(operand if isinstance(node.op, ast.UAdd) else -operand)
    if isinstance(node, ast.BinOp) and isinstance(node.op, _ALLOWED_BINOPS):
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        if isinstance(node.op, ast.Add):
            result = left + right
        elif isinstance(node.op, ast.Sub):
            result = left - right
        elif isinstance(node.op, ast.Mult):
            result = left * right
        else:
            if right == 0:
                raise ValueError("除数不能为 0")
            result = left / right
        return _check_value(result)
    raise ValueError("表达式含不支持的语法（只允许数字与 +-*/ 及括号）")


def evaluate_arithmetic(expression: str) -> str:
    """求值一个受限四则表达式并返回字符串结果；任何非法输入抛 ``ValueError``。

    兼容原有教学语义：逗号视为千分位分隔符，``%`` 折算为 ``/100``。
    """
    if not isinstance(expression, str) or not expression.strip():
        raise ValueError("表达式不能为空")
    if len(expression) > _MAX_EXPR_CHARS:
        raise ValueError(f"表达式过长（上限 {_MAX_EXPR_CHARS} 字符）")
    if any(ch not in _ALLOWED_CHARS for ch in expression):
        raise ValueError("表达式包含非法字符，只允许数字与 +-*/().,% 及空格")

    normalized = expression.replace(",", "").replace("%", "/100")
    try:
        tree = ast.parse(normalized, mode="eval")
    except (SyntaxError, ValueError) as exc:
        raise ValueError(f"表达式语法错误：{exc}") from exc
    if sum(1 for _ in ast.walk(tree)) > _MAX_AST_NODES:
        raise ValueError("表达式结构过于复杂")
    return str(_eval_node(tree))
