import sys

def check_syntax(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    brackets = {'{': '}', '(': ')', '[': ']'}
    stack = []
    lines = code.split('\n')
    errors = 0

    for line_num, line in enumerate(lines, 1):
        in_string = False
        string_char = None
        escaped = False
        in_comment = False
        
        for i, char in enumerate(line):
            if in_comment:
                continue
            if char == '/' and i + 1 < len(line) and line[i+1] == '/' and not in_string:
                in_comment = True
                continue
                
            if char in ['"', "'", '`'] and not escaped:
                if not in_string:
                    in_string = True
                    string_char = char
                elif string_char == char:
                    in_string = False
                    string_char = None
                continue
                
            if char == '\\':
                escaped = not escaped
            else:
                escaped = False
                
            if in_string:
                continue
                
            if char in brackets.keys():
                stack.append((char, line_num, line))
            elif char in brackets.values():
                if not stack:
                    print(f"Mismatched closing bracket {char} at line {line_num}: {line.strip()}")
                    errors += 1
                else:
                    top, top_line, top_content = stack.pop()
                    if brackets[top] != char:
                        print(f"Mismatched bracket {char} at line {line_num} does not match {top} from line {top_line}")
                        errors += 1

    if stack:
        print(f"Unclosed brackets left on stack: {len(stack)}")
        errors += len(stack)
        for top, top_line, top_content in stack[-5:]:
            print(f"  Unclosed {top} from line {top_line}: {top_content.strip()}")
            
    if errors == 0:
        print("Bracket matching check passed successfully!")
        return True
    return False

if __name__ == '__main__':
    check_syntax(r'C:\Users\sachi\.gemini\antigravity\scratch\accommodation-src-app\app.js')
