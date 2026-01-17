/**
 * Tokenizer for formula expressions
 *
 * Converts formula strings into a stream of tokens for parsing.
 */

import { SourcePosition, SourceRange } from './types';

/**
 * Token types supported by the formula language
 */
export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // Identifiers
  IDENTIFIER = 'IDENTIFIER',
  PROPERTY_REF = 'PROPERTY_REF',
  FUNCTION = 'FUNCTION',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  MODULO = 'MODULO',
  POWER = 'POWER',

  // Comparison
  EQUAL = 'EQUAL',
  NOT_EQUAL = 'NOT_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_EQUAL = 'LESS_EQUAL',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_EQUAL = 'GREATER_EQUAL',

  // Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  DOT = 'DOT',
  COLON = 'COLON',

  // Special
  EOF = 'EOF',
  WHITESPACE = 'WHITESPACE',
  COMMENT = 'COMMENT',
}

/**
 * A single token from the formula
 */
export interface Token {
  type: TokenType;
  value: string;
  literal?: string | number | boolean | null;
  range: SourceRange;
}

/**
 * Tokenizer error
 */
export class TokenizerError extends Error {
  constructor(
    message: string,
    public position: SourcePosition,
    public source: string
  ) {
    super(`${message} at line ${position.line}, column ${position.column}`);
    this.name = 'TokenizerError';
  }
}

/**
 * Reserved keywords mapped to token types
 */
const KEYWORDS: Record<string, TokenType> = {
  TRUE: TokenType.BOOLEAN,
  FALSE: TokenType.BOOLEAN,
  NULL: TokenType.NULL,
  AND: TokenType.AND,
  OR: TokenType.OR,
  NOT: TokenType.NOT,
};

/**
 * Tokenizer for formula expressions
 */
export class Tokenizer {
  private source: string;
  private position: number;
  private line: number;
  private column: number;
  private tokens: Token[];

  constructor() {
    this.source = '';
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  /**
   * Tokenize a formula string
   */
  tokenize(source: string): Token[] {
    this.source = source;
    this.position = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (!this.isAtEnd()) {
      const token = this.scanToken();
      if (token && token.type !== TokenType.WHITESPACE && token.type !== TokenType.COMMENT) {
        this.tokens.push(token);
      }
    }

    // Add EOF token
    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      range: {
        start: this.getCurrentPosition(),
        end: this.getCurrentPosition(),
      },
    });

    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }

  private getCurrentPosition(): SourcePosition {
    return { line: this.line, column: this.column, offset: this.position };
  }

  private advance(): string {
    const char = this.source[this.position];
    this.position++;
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return char;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position];
  }

  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.position] !== expected) return false;
    this.advance();
    return true;
  }

  private scanToken(): Token | null {
    const startPosition = this.getCurrentPosition();
    const char = this.advance();

    // Whitespace
    if (/\s/.test(char)) {
      return this.whitespace(startPosition);
    }

    // Comments
    if (char === '/' && this.peek() === '/') {
      return this.lineComment(startPosition);
    }
    if (char === '/' && this.peek() === '*') {
      return this.blockComment(startPosition);
    }

    // Single character tokens
    switch (char) {
      case '(':
        return this.makeToken(TokenType.LPAREN, char, startPosition);
      case ')':
        return this.makeToken(TokenType.RPAREN, char, startPosition);
      case '[':
        return this.makeToken(TokenType.LBRACKET, char, startPosition);
      case ']':
        return this.makeToken(TokenType.RBRACKET, char, startPosition);
      case ',':
        return this.makeToken(TokenType.COMMA, char, startPosition);
      case '.':
        return this.makeToken(TokenType.DOT, char, startPosition);
      case ':':
        return this.makeToken(TokenType.COLON, char, startPosition);
      case '+':
        return this.makeToken(TokenType.PLUS, char, startPosition);
      case '-':
        return this.makeToken(TokenType.MINUS, char, startPosition);
      case '*':
        return this.makeToken(TokenType.MULTIPLY, char, startPosition);
      case '/':
        return this.makeToken(TokenType.DIVIDE, char, startPosition);
      case '%':
        return this.makeToken(TokenType.MODULO, char, startPosition);
      case '^':
        return this.makeToken(TokenType.POWER, char, startPosition);

      // Two-character tokens
      case '=':
        return this.makeToken(TokenType.EQUAL, char, startPosition);
      case '!':
        if (this.match('=')) {
          return this.makeToken(TokenType.NOT_EQUAL, '!=', startPosition);
        }
        return this.makeToken(TokenType.NOT, char, startPosition);
      case '<':
        if (this.match('=')) {
          return this.makeToken(TokenType.LESS_EQUAL, '<=', startPosition);
        }
        if (this.match('>')) {
          return this.makeToken(TokenType.NOT_EQUAL, '<>', startPosition);
        }
        return this.makeToken(TokenType.LESS_THAN, char, startPosition);
      case '>':
        if (this.match('=')) {
          return this.makeToken(TokenType.GREATER_EQUAL, '>=', startPosition);
        }
        return this.makeToken(TokenType.GREATER_THAN, char, startPosition);

      // String literals
      case '"':
      case "'":
        return this.string(char, startPosition);

      // Property references with braces
      case '{':
        return this.propertyReference(startPosition);

      default:
        // Numbers
        if (this.isDigit(char)) {
          return this.number(char, startPosition);
        }

        // Identifiers and keywords
        if (this.isAlpha(char)) {
          return this.identifier(char, startPosition);
        }

        throw new TokenizerError(`Unexpected character: ${char}`, startPosition, this.source);
    }
  }

  private makeToken(
    type: TokenType,
    value: string,
    startPosition: SourcePosition,
    literal?: string | number | boolean | null
  ): Token {
    return {
      type,
      value,
      literal,
      range: {
        start: startPosition,
        end: this.getCurrentPosition(),
      },
    };
  }

  private whitespace(startPosition: SourcePosition): Token {
    while (!this.isAtEnd() && /\s/.test(this.peek())) {
      this.advance();
    }
    return this.makeToken(TokenType.WHITESPACE, '', startPosition);
  }

  private lineComment(startPosition: SourcePosition): Token {
    this.advance(); // consume second /
    let value = '//';
    while (!this.isAtEnd() && this.peek() !== '\n') {
      value += this.advance();
    }
    return this.makeToken(TokenType.COMMENT, value, startPosition);
  }

  private blockComment(startPosition: SourcePosition): Token {
    this.advance(); // consume *
    let value = '/*';
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        value += this.advance(); // *
        value += this.advance(); // /
        break;
      }
      value += this.advance();
    }
    return this.makeToken(TokenType.COMMENT, value, startPosition);
  }

  private string(quote: string, startPosition: SourcePosition): Token {
    let value = '';
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        const escaped = this.advance();
        switch (escaped) {
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          case 'r':
            value += '\r';
            break;
          case '\\':
            value += '\\';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          default:
            value += escaped;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new TokenizerError('Unterminated string', startPosition, this.source);
    }

    this.advance(); // closing quote
    return this.makeToken(TokenType.STRING, `${quote}${value}${quote}`, startPosition, value);
  }

  private propertyReference(startPosition: SourcePosition): Token {
    let value = '';
    while (!this.isAtEnd() && this.peek() !== '}') {
      value += this.advance();
    }

    if (this.isAtEnd()) {
      throw new TokenizerError('Unterminated property reference', startPosition, this.source);
    }

    this.advance(); // closing brace
    return this.makeToken(TokenType.PROPERTY_REF, `{${value}}`, startPosition, value);
  }

  private number(firstChar: string, startPosition: SourcePosition): Token {
    let value = firstChar;

    while (!this.isAtEnd() && this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // consume .
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    // Exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      value += this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        value += this.advance();
      }
      while (!this.isAtEnd() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    return this.makeToken(TokenType.NUMBER, value, startPosition, parseFloat(value));
  }

  private identifier(firstChar: string, startPosition: SourcePosition): Token {
    let value = firstChar;

    while (!this.isAtEnd() && this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    const upperValue = value.toUpperCase();

    // Check for keywords
    if (KEYWORDS[upperValue]) {
      const tokenType = KEYWORDS[upperValue];
      let literal: boolean | null = null;
      if (upperValue === 'TRUE') literal = true;
      if (upperValue === 'FALSE') literal = false;
      return this.makeToken(tokenType, value, startPosition, literal);
    }

    // Check if it's a function call (followed by opening paren)
    if (this.peek() === '(') {
      return this.makeToken(TokenType.FUNCTION, value, startPosition, upperValue);
    }

    return this.makeToken(TokenType.IDENTIFIER, value, startPosition, value);
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
