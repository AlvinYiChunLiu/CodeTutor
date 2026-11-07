# Video Script: What Is Recursion?

**Level:** Beginner  
**Language:** Python  
**Summary:** A function solves a problem by calling itself on a smaller version of the same problem.

## Chapter 1: The Idea

### Scene c1-s1: Title

**On screen:** What is Recursion? / Functions that call themselves

**Voiceover:** Let's learn recursion: a function that solves a problem by calling itself.

### Scene c1-s2: Factorial Function

**On screen:** Show the factorial function and highlight the function definition.

```python
def factorial(n):
    if n == 1:
        return 1
    return n * factorial(n - 1)
```

**Voiceover:** Here's factorial. It takes a number n and multiplies it by every number below it.

## Chapter 2: Base Case and Recursive Case

### Scene c2-s1: Base Case

**On screen:** Highlight the condition and return on line 2.

```python
def factorial(n):
    if n == 1:
        return 1
    return n * factorial(n - 1)
```

**Voiceover:** First, the base case. When n is one, we stop and return one. Without this, it would never end.

### Scene c2-s2: Recursive Case

**On screen:** Highlight the recursive call on line 4.

```python
def factorial(n):
    if n == 1:
        return 1
    return n * factorial(n - 1)
```

**Voiceover:** Otherwise, the function calls itself with n minus one, a slightly smaller problem.

## Chapter 3: Watching It Run

### Scene c3-s1: Call Stack

**On screen:** Show the calls `factorial(3)`, `factorial(2)`, and `factorial(1)` on the call stack. The base case returns 1.

**Voiceover:** Each call waits on the stack until the base case returns. Then the answers multiply back up.

### Scene c3-s2: Output

**On screen:**

```text
>>> factorial(3)
6
```

**Voiceover:** Three times two times one gives us six.

### Scene c3-s3: Recap

**On screen:**

1. A recursive function calls itself.
2. The base case stops the recursion.
3. Each call works on a smaller problem.

**Voiceover:** Remember: a base case to stop, and a smaller problem on every call.