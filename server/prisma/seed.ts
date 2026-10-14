import bcrypt from 'bcryptjs';
import { LessonType, PrismaClient } from '@prisma/client';
import { indexCourse } from '../src/modules/ai/retrieval/indexer';

const prisma = new PrismaClient();

type L = { title: string; type: LessonType; body?: string; durationMin?: number; extra?: Record<string, unknown> };

async function course(opts: { title: string; description: string; level: string; categoryId: string; instructorId: string; modules: { title: string; lessons: L[] }[] }) {
  const c = await prisma.course.create({
    data: { title: opts.title, description: opts.description, level: opts.level, categoryId: opts.categoryId, instructorId: opts.instructorId, status: 'PUBLISHED' },
  });
  const out: Record<string, string> = {};
  for (const [mi, m] of opts.modules.entries()) {
    const mod = await prisma.module.create({ data: { courseId: c.id, title: m.title, position: mi } });
    for (const [li, l] of m.lessons.entries()) {
      const lesson = await prisma.lesson.create({
        data: { moduleId: mod.id, courseId: c.id, title: l.title, type: l.type, body: l.body ?? '', durationMin: l.durationMin ?? 10, position: li, ...(l.extra as object) },
      });
      out[l.title] = lesson.id;
    }
  }
  return { course: c, lessons: out };
}

async function main() {
  // clean slate so the seed can be re-run
  await prisma.$executeRawUnsafe(
    'TRUNCATE "User","Category","AiUsage","AiLog","AuditLog" RESTART IDENTITY CASCADE'
  );
  const pw = await bcrypt.hash('Password123!', 10);
  const admin = await prisma.user.create({ data: { name: 'Admin User', email: 'admin@gvpathshala.dev', passwordHash: pw, role: 'ADMIN' } });
  const teacher = await prisma.user.create({ data: { name: 'Dr. Meera Rao', email: 'instructor@gvpathshala.dev', passwordHash: pw, role: 'INSTRUCTOR' } });
  const teacher2 = await prisma.user.create({ data: { name: 'Prof. Kiran Nair', email: 'instructor2@gvpathshala.dev', passwordHash: pw, role: 'INSTRUCTOR' } });
  const student = await prisma.user.create({ data: { name: 'Aarav Sharma', email: 'student@gvpathshala.dev', passwordHash: pw, interests: ['Data'] } });
  const idle = await prisma.user.create({ data: { name: 'Priya Singh', email: 'priya@gvpathshala.dev', passwordHash: pw } });

  const prog = await prisma.category.create({ data: { name: 'Programming' } });
  const data = await prisma.category.create({ data: { name: 'Data' } });
  const design = await prisma.category.create({ data: { name: 'Design' } });

  const web = await course({
    title: 'Web development fundamentals', level: 'Beginner', categoryId: prog.id, instructorId: teacher.id,
    description: 'Build your first responsive websites with HTML, CSS and JavaScript, finishing with a small working app.',
    modules: [
      { title: 'Getting started', lessons: [
        { title: 'How the web works', type: 'VIDEO', durationMin: 9, body:
`When you type a web address into a browser, the browser asks a DNS server to translate the name into an IP address. It then sends an HTTP request to the server at that address.

The server replies with a response that contains HTML, the structure of the page. The browser reads the HTML and may request more files, such as CSS for styling, JavaScript for behaviour and images.

A web server is simply a computer that stores website files and answers requests. A browser is the program that sends requests and turns the responses into the page you see.` },
        { title: 'Setting up your code editor', type: 'READING', durationMin: 6, body:
`Pick an editor you will enjoy opening every day. Visual Studio Code is free, runs on Windows, macOS and Linux, and has a large library of extensions.

Install it, then add two extensions: Live Server, which refreshes your page whenever you save, and Prettier, which keeps your code tidy.

Create a folder called my-site, open it in the editor and add a file named index.html. You will fill it in during the next lesson.` },
        { title: 'Your first web page', type: 'VIDEO', durationMin: 12, body:
`An HTML page is made of elements. An element has an opening tag, content and a closing tag, for example a heading written as h1.

Every page starts with a doctype, then an html element that contains a head and a body. The head holds the title and settings. The body holds everything people see: headings, paragraphs, links and images.

Use the a element with an href attribute to make a link, and the img element with src and alt attributes to show an image. Always write alt text so screen readers can describe the picture.` },
      ]},
      { title: 'Styling with CSS', lessons: [
        { title: 'Selectors and the box model', type: 'VIDEO', durationMin: 14, body:
`CSS rules choose elements with selectors and then set properties. A class selector starts with a dot, like .card, and can be used on many elements. An id selector starts with a hash, like #hero, and should appear only once on a page. An element selector, like p, targets every paragraph.

Every element is a box. From the inside out, the box model has four layers: content, padding, border and margin. Padding is the space inside the border, between the content and the border. Margin is the space outside the border that pushes other elements away.

Set box-sizing to border-box so that padding and border are included in the width you set. This makes layouts much easier to predict.` },
        { title: 'Layout with flexbox', type: 'VIDEO', durationMin: 16, body:
`Flexbox lays out items in a row or a column. Set display to flex on the parent element, called the flex container, and its children become flex items.

The main axis is the direction items flow. In a row layout the main axis is horizontal. The justify-content property spreads items along the main axis, with values such as flex-start, center and space-between. The cross axis runs the other way, and align-items controls how items line up along it.

Use gap to add space between items, and flex-wrap to let items move onto a new line when there is not enough room. Setting flex-direction to column switches the main axis to vertical, so justify-content then works vertically.` },
        { title: 'Quiz: CSS basics', type: 'QUIZ', durationMin: 10, body: 'Check what you learned about selectors, the box model and flexbox.', extra: { passMark: 60, dueDate: new Date(Date.now() + 5 * 864e5) } },
      ]},
      { title: 'Adding behaviour with JavaScript', lessons: [
        { title: 'Variables and functions', type: 'VIDEO', durationMin: 15, body:
`A variable stores a value so you can use it later. Declare one with const when the value will not change and with let when it will. Names should describe what the value means, such as totalPrice.

A function wraps steps you want to reuse. You define it once and call it by name, passing in values called arguments. A function can return a result with the return keyword.

Arrow functions are a shorter way to write functions. For example, a function that doubles a number can be written as const double = (n) => n * 2.` },
        { title: 'Responding to clicks and input', type: 'VIDEO', durationMin: 13, body:
`The DOM is the browser's live model of your page. JavaScript can read and change it. Use document.querySelector with a CSS selector to find an element.

An event is something that happens, such as a click or a key press. Use addEventListener to run a function when an event happens. For a button, listen for the click event. For a text box, listen for the input event to react to each change.

Inside the handler you can change text with textContent, add or remove classes with classList, and create new elements with createElement.` },
        { title: 'Assignment: build a to-do app', type: 'ASSIGNMENT', durationMin: 60,
          body: 'Build a small to-do list in HTML, CSS and JavaScript. Visitors must be able to add a task, mark it done and delete it. Include a short README explaining how to run it and one thing you would improve.',
          extra: { dueDate: new Date(Date.now() + 9 * 864e5), maxScore: 100, rubric: 'Works as described (40). Code is readable, with small named functions (30). Handles empty input (15). README is clear (15).' } },
      ]},
    ],
  });

  const db = await course({
    title: 'Database design with SQL', level: 'Intermediate', categoryId: data.id, instructorId: teacher2.id,
    description: 'Model data with tables and keys, then query it confidently with SELECT, JOIN and GROUP BY.',
    modules: [
      { title: 'Relational basics', lessons: [
        { title: 'Tables, rows and keys', type: 'VIDEO', durationMin: 11, body:
`A relational database stores data in tables. Each row is one record and each column is one attribute. A primary key is a column, or set of columns, that uniquely identifies each row.

A foreign key is a column that refers to the primary key of another table. It is how tables are linked, for example an orders table pointing to a customers table.` },
        { title: 'Writing SELECT queries', type: 'VIDEO', durationMin: 14, body:
`SELECT chooses which columns to return and FROM names the table. The WHERE clause filters rows before they are returned. ORDER BY sorts the result and LIMIT restricts how many rows come back.

DISTINCT removes duplicate rows from the result. For example, SELECT DISTINCT city FROM customers lists each city once.` },
        { title: 'Quiz: SELECT queries', type: 'QUIZ', durationMin: 10, body: 'Practise filtering and sorting.', extra: { passMark: 60 } },
      ]},
      { title: 'Joins and design', lessons: [
        { title: 'Joins explained', type: 'VIDEO', durationMin: 17, body:
`A JOIN combines rows from two tables that share a key. An INNER JOIN keeps only rows that match in both tables. A LEFT JOIN keeps every row from the left table and fills missing matches with NULL.

Write the join condition after the ON keyword, for example ON orders.customer_id = customers.id.` },
      ]},
    ],
  });

  const ds = await course({
    title: 'Data structures in Python', level: 'Intermediate', categoryId: prog.id, instructorId: teacher.id,
    description: 'Lists, stacks, queues, trees and graphs, with the reasoning for choosing each one.',
    modules: [{ title: 'Linear structures', lessons: [
      { title: 'Lists and arrays', type: 'VIDEO', durationMin: 12, body: 'A list stores items in order and lets you reach any item by its position. Appending to the end of a Python list is fast, while inserting at the start is slow because every item must move.' },
      { title: 'Stacks and queues', type: 'VIDEO', durationMin: 15, body: 'A stack is last in, first out, like a pile of plates. A queue is first in, first out, like people waiting in line. In Python, use a list for a stack and collections.deque for a queue.' },
    ]}],
  });
  await course({
    title: 'UX design basics', level: 'Beginner', categoryId: design.id, instructorId: teacher.id,
    description: 'Research users, sketch flows and test your ideas with simple prototypes.',
    modules: [{ title: 'Understanding users', lessons: [
      { title: 'User research in a day', type: 'VIDEO', durationMin: 13, body: 'You can learn a lot from five short interviews. Ask people to describe the last time they did the task, and listen for the moments that frustrated them.' },
      { title: 'Writing a problem statement', type: 'READING', durationMin: 7, body: 'A good problem statement names who is struggling, what they are trying to do and why it matters. It does not mention a solution.' },
    ]}],
  });

  // Quiz questions for the CSS quiz, tagged by topic so the analyzer can find weak spots
  const q = (lessonId: string, text: string, options: string[], correctIndex: number, topic: string, explanation: string) =>
    prisma.question.create({ data: { lessonId, text, options, correctIndex, topic, explanation, status: 'APPROVED', source: 'MANUAL' } });
  const cssQuiz = web.lessons['Quiz: CSS basics'];
  const qs = [
    await q(cssQuiz, 'Which property adds space inside an element, between its content and its border?', ['margin', 'padding', 'gap', 'outline'], 1, 'Box model', 'Padding is inside the border. Margin is outside it.'),
    await q(cssQuiz, 'In the box model, which layer sits outermost?', ['Content', 'Padding', 'Border', 'Margin'], 3, 'Box model', 'From the inside out: content, padding, border, margin.'),
    await q(cssQuiz, 'What does display: flex do on a parent element?', ['Hides its children', 'Lays children out along one axis', 'Makes text bold', 'Adds a border'], 1, 'Flexbox', 'It turns the parent into a flex container.'),
    await q(cssQuiz, 'Which selector targets the element with id="hero"?', ['.hero', 'hero', '#hero', '*hero'], 2, 'Selectors', 'Ids use a hash.'),
    await q(cssQuiz, 'Which property aligns flex items along the cross axis?', ['justify-content', 'align-items', 'flex-wrap', 'order'], 1, 'Flexbox', 'align-items works on the cross axis.'),
  ];
  const sqlQuiz = db.lessons['Quiz: SELECT queries'];
  await q(sqlQuiz, 'Which clause filters rows before they are returned?', ['ORDER BY', 'GROUP BY', 'WHERE', 'LIMIT'], 2, 'Filtering', 'WHERE filters rows.');
  await q(sqlQuiz, 'Which keyword removes duplicate rows from a result?', ['UNIQUE', 'DISTINCT', 'SINGLE', 'DROP'], 1, 'Filtering', 'DISTINCT removes duplicates.');
  await q(sqlQuiz, 'What does SELECT * FROM books LIMIT 5 return?', ['Five columns', 'At most five rows', 'Only the fifth row', 'An error'], 1, 'Limits', 'LIMIT caps the number of rows.');

  // Enroll Aarav and give him some progress; Priya enrolled but inactive
  for (const c of [web.course, db.course]) await prisma.enrollment.create({ data: { userId: student.id, courseId: c.id } });
  await prisma.enrollment.create({ data: { userId: idle.id, courseId: web.course.id, enrolledAt: new Date(Date.now() - 10 * 864e5) } });
  for (const t of ['How the web works', 'Setting up your code editor', 'Your first web page', 'Selectors and the box model'])
    await prisma.lessonProgress.create({ data: { userId: student.id, lessonId: web.lessons[t], completed: true } });
  await prisma.lessonProgress.create({ data: { userId: student.id, lessonId: db.lessons['Tables, rows and keys'], completed: true } });
  await prisma.lessonProgress.create({ data: { userId: idle.id, lessonId: web.lessons['How the web works'], completed: true, updatedAt: new Date(Date.now() - 9 * 864e5) } });
  // two failed attempts for Priya on the CSS quiz
  for (let i = 0; i < 2; i++)
    await prisma.quizAttempt.create({ data: { userId: idle.id, lessonId: cssQuiz, answers: qs.map((x) => ({ questionId: x.id, choice: 0 })), score: 1, total: 5, passed: false, takenAt: new Date(Date.now() - 8 * 864e5) } });

  await prisma.review.create({ data: { userId: student.id, courseId: web.course.id, rating: 5, text: 'Clear and practical.' } });
  await prisma.announcement.create({ data: { courseId: web.course.id, authorId: teacher.id, title: 'Mid-term quiz window opens Monday', body: 'Revise selectors, the box model and flexbox.' } });

  // Build the tutor's knowledge base
  for (const c of [web.course, db.course, ds.course]) console.log('Indexed', await indexCourse(c.id), 'passages for', c.title);
  void admin;
  console.log('\nSeed complete. Sign in with password Password123! as:\n  student@gvpathshala.dev\n  instructor@gvpathshala.dev\n  admin@gvpathshala.dev');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
