// 레슨 2: 자료형과 연산자

// 1) 자료형 3가지
const text = "안녕";       // 문자열 (string)
const num = 10;            // 숫자 (number)
const isStudent = true;    // 불리언 (boolean): true 또는 false

console.log(typeof text, typeof num, typeof isStudent);

// 2) 산술 연산자
console.log(10 + 3);   // 13
console.log(10 - 3);   // 7
console.log(10 * 3);   // 30
console.log(10 / 3);   // 3.3333...
console.log(10 % 3);   // 1 (나머지)
console.log(2 ** 3);   // 8 (거듭제곱)

// 3) 문자열 + 숫자 주의!
console.log("10" + 3);   // "103" (이어붙임)
console.log("10" - 3);   // 7 (숫자로 계산)

// 4) 비교 연산자 → 결과는 true/false
console.log(5 > 3);      // true
console.log(5 === 5);    // true (값이 같은가)
console.log(5 === "5");  // false (자료형도 비교)
console.log(5 !== 3);    // true (다른가)

// 5) 논리 연산자
console.log(true && false);  // false (그리고)
console.log(true || false);  // true  (또는)
console.log(!true);          // false (반대)

// 연습문제는 아래에 작성하세요
