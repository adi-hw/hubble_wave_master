/**
 * Parser for formula expressions
 *
 * Builds an Abstract Syntax Tree (AST) from tokenized formulas.
 */

import { Token, TokenType, Tokenizer } from './tokenizer';
import { SourceRange } from './types';

/**
 * AST node types
 */
export enum ASTNodeType {
  // Literals
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',
  BOOLEAN_LITERAL = 'BOOLEAN_LITERAL',
  NULL_LITERAL = 'NULL_LITERAL',

  // Expressions
  BINARY_EXPR = 'BINARY_EXPR',
  UNARY_EXPR = 'UNARY_EXPR',
  LOGICAL_EXPR = 'LOGICAL_EXPR',
  CONDITIONAL_EXPR = 'CONDITIONAL_EXPR',

  // References
  PROPERTY_REF = 'PROPERTY_REF',
  IDENTIFIER = 'IDENTIFIER',
  MEMBER_ACCESS = 'MEMBER_ACCESS',
  INDEX_ACCESS = 'INDEX_ACCESS',

  // Functions
  FUNCTION_CALL = 'FUNCTION_CALL',

  // Array/Object
  ARRAY_LITERAL = 'ARRAY_LITERAL',
  OBJECT_LITERAL = 'OBJECT_LITERAL',

  // Program
  PROGRAM = 'PROGRAM',
}

/**
 * Binary operators
 */
export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>=';

/**
 * Unary operators
 */
export type UnaryOperator = '-' | 'NOT';

/**
 * Logical operators
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Base AST node interface
 */
export interface ASTNodeBase {
  type: ASTNodeType;
  range: SourceRange;
}

/**
 * Number literal node
 */
export interface NumberLiteralNode extends ASTNodeBase {
  type: ASTNodeType.NUMBER_LITERAL;
  value: number;
}

/**
 * String literal node
 */
export interface StringLiteralNode extends ASTNodeBase {
  type: ASTNodeType.STRING_LITERAL;
  value: string;
}

/**
 * Boolean literal node
 */
export interface BooleanLiteralNode extends ASTNodeBase {
  type: ASTNodeType.BOOLEAN_LITERAL;
  value: boolean;
}

/**
 * Null literal node
 */
export interface NullLiteralNode extends ASTNodeBase {
  type: ASTNodeType.NULL_LITERAL;
}

/**
 * Binary expression node
 */
export interface BinaryExprNode extends ASTNodeBase {
  type: ASTNodeType.BINARY_EXPR;
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

/**
 * Unary expression node
 */
export interface UnaryExprNode extends ASTNodeBase {
  type: ASTNodeType.UNARY_EXPR;
  operator: UnaryOperator;
  argument: ASTNode;
}

/**
 * Logical expression node
 */
export interface LogicalExprNode extends ASTNodeBase {
  type: ASTNodeType.LOGICAL_EXPR;
  operator: LogicalOperator;
  left: ASTNode;
  right: ASTNode;
}

/**
 * Property reference node (e.g., {PropertyCode})
 */
export interface PropertyRefNode extends ASTNodeBase {
  type: ASTNodeType.PROPERTY_REF;
  property: string;
}

/**
 * Identifier node
 */
export interface IdentifierNode extends ASTNodeBase {
  type: ASTNodeType.IDENTIFIER;
  name: string;
}

/**
 * Member access node (e.g., object.property)
 */
export interface MemberAccessNode extends ASTNodeBase {
  type: ASTNodeType.MEMBER_ACCESS;
  object: ASTNode;
  property: string;
}

/**
 * Index access node (e.g., array[0])
 */
export interface IndexAccessNode extends ASTNodeBase {
  type: ASTNodeType.INDEX_ACCESS;
  object: ASTNode;
  index: ASTNode;
}

/**
 * Function call node
 */
export interface FunctionCallNode extends ASTNodeBase {
  type: ASTNodeType.FUNCTION_CALL;
  name: string;
  arguments: ASTNode[];
}

/**
 * Array literal node
 */
export interface ArrayLiteralNode extends ASTNodeBase {
  type: ASTNodeType.ARRAY_LITERAL;
  elements: ASTNode[];
}

/**
 * Object literal node
 */
export interface ObjectLiteralNode extends ASTNodeBase {
  type: ASTNodeType.OBJECT_LITERAL;
  properties: { key: string; value: ASTNode }[];
}

/**
 * Program node (root)
 */
export interface ProgramNode extends ASTNodeBase {
  type: ASTNodeType.PROGRAM;
  body: ASTNode;
}

/**
 * Union of all AST node types
 */
export type ASTNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode
  | BinaryExprNode
  | UnaryExprNode
  | LogicalExprNode
  | PropertyRefNode
  | IdentifierNode
  | MemberAccessNode
  | IndexAccessNode
  | FunctionCallNode
  | ArrayLiteralNode
  | ObjectLiteralNode
  | ProgramNode;

/**
 * Parser error
 */
export class ParserError extends Error {
  constructor(
    message: string,
    public range: SourceRange,
    public token?: Token
  ) {
    super(message);
    this.name = 'ParserError';
  }
}

/**
 * Parser for formula expressions
 *
 * Uses recursive descent parsing with operator precedence.
 */
export class Parser {
  private tokenizer: Tokenizer;
  private tokens: Token[];
  private current: number;

  constructor() {
    this.tokenizer = new Tokenizer();
    this.tokens = [];
    this.current = 0;
  }

  /**
   * Parse a formula string into an AST
   */
  parse(source: string): ProgramNode {
    this.tokens = this.tokenizer.tokenize(source);
    this.current = 0;

    const body = this.expression();

    if (!this.isAtEnd()) {
      throw new ParserError(
        `Unexpected token: ${this.peek().value}`,
        this.peek().range,
        this.peek()
      );
    }

    return {
      type: ASTNodeType.PROGRAM,
      body,
      range: body.range,
    };
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new ParserError(message, this.peek().range, this.peek());
  }

  // Expression parsing with precedence climbing
  private expression(): ASTNode {
    return this.orExpression();
  }

  private orExpression(): ASTNode {
    let left = this.andExpression();

    while (this.match(TokenType.OR)) {
      const operator = 'OR' as LogicalOperator;
      const right = this.andExpression();
      left = {
        type: ASTNodeType.LOGICAL_EXPR,
        operator,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private andExpression(): ASTNode {
    let left = this.equalityExpression();

    while (this.match(TokenType.AND)) {
      const operator = 'AND' as LogicalOperator;
      const right = this.equalityExpression();
      left = {
        type: ASTNodeType.LOGICAL_EXPR,
        operator,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private equalityExpression(): ASTNode {
    let left = this.comparisonExpression();

    while (this.match(TokenType.EQUAL, TokenType.NOT_EQUAL)) {
      const operator = this.previous().value === '=' ? '=' : '!=';
      const right = this.comparisonExpression();
      left = {
        type: ASTNodeType.BINARY_EXPR,
        operator: operator as BinaryOperator,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private comparisonExpression(): ASTNode {
    let left = this.additionExpression();

    while (
      this.match(
        TokenType.LESS_THAN,
        TokenType.LESS_EQUAL,
        TokenType.GREATER_THAN,
        TokenType.GREATER_EQUAL
      )
    ) {
      const operatorMap: Record<string, BinaryOperator> = {
        '<': '<',
        '<=': '<=',
        '>': '>',
        '>=': '>=',
      };
      const operator = operatorMap[this.previous().value];
      const right = this.additionExpression();
      left = {
        type: ASTNodeType.BINARY_EXPR,
        operator,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private additionExpression(): ASTNode {
    let left = this.multiplicationExpression();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().value as BinaryOperator;
      const right = this.multiplicationExpression();
      left = {
        type: ASTNodeType.BINARY_EXPR,
        operator,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private multiplicationExpression(): ASTNode {
    let left = this.powerExpression();

    while (this.match(TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.MODULO)) {
      const operator = this.previous().value as BinaryOperator;
      const right = this.powerExpression();
      left = {
        type: ASTNodeType.BINARY_EXPR,
        operator,
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private powerExpression(): ASTNode {
    let left = this.unaryExpression();

    while (this.match(TokenType.POWER)) {
      const right = this.unaryExpression();
      left = {
        type: ASTNodeType.BINARY_EXPR,
        operator: '^',
        left,
        right,
        range: { start: left.range.start, end: right.range.end },
      };
    }

    return left;
  }

  private unaryExpression(): ASTNode {
    if (this.match(TokenType.MINUS)) {
      const startRange = this.previous().range;
      const argument = this.unaryExpression();
      return {
        type: ASTNodeType.UNARY_EXPR,
        operator: '-',
        argument,
        range: { start: startRange.start, end: argument.range.end },
      };
    }

    if (this.match(TokenType.NOT)) {
      const startRange = this.previous().range;
      const argument = this.unaryExpression();
      return {
        type: ASTNodeType.UNARY_EXPR,
        operator: 'NOT',
        argument,
        range: { start: startRange.start, end: argument.range.end },
      };
    }

    return this.callExpression();
  }

  private callExpression(): ASTNode {
    let expr = this.primaryExpression();

    // Handle member access and index access
    while (true) {
      if (this.match(TokenType.DOT)) {
        const property = this.consume(TokenType.IDENTIFIER, 'Expected property name after "."');
        expr = {
          type: ASTNodeType.MEMBER_ACCESS,
          object: expr,
          property: property.value,
          range: { start: expr.range.start, end: property.range.end },
        };
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        const closing = this.consume(TokenType.RBRACKET, 'Expected "]" after index');
        expr = {
          type: ASTNodeType.INDEX_ACCESS,
          object: expr,
          index,
          range: { start: expr.range.start, end: closing.range.end },
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private primaryExpression(): ASTNode {
    // Number literal
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return {
        type: ASTNodeType.NUMBER_LITERAL,
        value: token.literal as number,
        range: token.range,
      };
    }

    // String literal
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: ASTNodeType.STRING_LITERAL,
        value: token.literal as string,
        range: token.range,
      };
    }

    // Boolean literal
    if (this.match(TokenType.BOOLEAN)) {
      const token = this.previous();
      return {
        type: ASTNodeType.BOOLEAN_LITERAL,
        value: token.literal as boolean,
        range: token.range,
      };
    }

    // Null literal
    if (this.match(TokenType.NULL)) {
      const token = this.previous();
      return {
        type: ASTNodeType.NULL_LITERAL,
        range: token.range,
      };
    }

    // Property reference {PropertyCode}
    if (this.match(TokenType.PROPERTY_REF)) {
      const token = this.previous();
      return {
        type: ASTNodeType.PROPERTY_REF,
        property: token.literal as string,
        range: token.range,
      };
    }

    // Function call
    if (this.match(TokenType.FUNCTION)) {
      const nameToken = this.previous();
      this.consume(TokenType.LPAREN, 'Expected "(" after function name');

      const args: ASTNode[] = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }

      const closing = this.consume(TokenType.RPAREN, 'Expected ")" after function arguments');

      return {
        type: ASTNodeType.FUNCTION_CALL,
        name: nameToken.literal as string,
        arguments: args,
        range: { start: nameToken.range.start, end: closing.range.end },
      };
    }

    // Identifier
    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();
      return {
        type: ASTNodeType.IDENTIFIER,
        name: token.value,
        range: token.range,
      };
    }

    // Grouped expression
    if (this.match(TokenType.LPAREN)) {
      const startRange = this.previous().range;
      const expr = this.expression();
      const closing = this.consume(TokenType.RPAREN, 'Expected ")" after expression');
      // Update range to include parentheses
      expr.range = { start: startRange.start, end: closing.range.end };
      return expr;
    }

    // Array literal
    if (this.match(TokenType.LBRACKET)) {
      const startRange = this.previous().range;
      const elements: ASTNode[] = [];

      if (!this.check(TokenType.RBRACKET)) {
        do {
          elements.push(this.expression());
        } while (this.match(TokenType.COMMA));
      }

      const closing = this.consume(TokenType.RBRACKET, 'Expected "]" after array elements');

      return {
        type: ASTNodeType.ARRAY_LITERAL,
        elements,
        range: { start: startRange.start, end: closing.range.end },
      };
    }

    throw new ParserError(
      `Unexpected token: ${this.peek().value}`,
      this.peek().range,
      this.peek()
    );
  }
}
