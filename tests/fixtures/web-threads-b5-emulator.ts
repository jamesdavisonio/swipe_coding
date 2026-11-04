// Shared helpers for the web-threads B5 emulator suites (tests/emulator/web-threads-b5-*.test.ts).
// Builds on the B4 emulator fixture, which owns the emulator lifecycle (useEmulator), the mocked
// firebase.ts and logger, and the task read-backs; this adds the todo and whole-collection
// read-backs B5's writes need. Everything is read and seeded as James, through the real rules
// (James may write todos and projects). Run with `npm run test:rules` (project demo-kanban).
import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import type { Project, Task, Todo } from '../../packages/shared/src/index.ts'
import { T0, jamesDb } from './web-threads-b4-emulator.ts'

export const makeTodo = (id: string, over: Partial<Todo> = {}): Todo => ({
  id,
  projectId: 'p1',
  body: `Todo ${id}`,
  link: null,
  done: false,
  sourceTaskId: null,
  createdAt: T0,
  doneAt: null,
  ...over,
})

export async function seedTodo(todo: Todo): Promise<Todo> {
  await setDoc(doc(jamesDb(), 'todos', todo.id), todo)
  return todo
}

export async function seedProject(id: string): Promise<Project> {
  const project: Project = {
    id,
    hostname: 'desk-pc',
    cwd: `C:/code/${id}`,
    name: id,
    createdAt: T0,
    updatedAt: T0,
  }
  await setDoc(doc(jamesDb(), 'projects', id), project)
  return project
}

// Every todo, by document id, oldest first.
export async function readTodos(): Promise<Todo[]> {
  const snap = await getDocs(collection(jamesDb(), 'todos'))
  return snap.docs
    .map((d) => ({ ...(d.data() as Todo), id: d.id }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// Every task, by document id.
export async function readTasks(): Promise<Task[]> {
  const snap = await getDocs(collection(jamesDb(), 'tasks'))
  return snap.docs.map((d) => ({ ...(d.data() as Task), id: d.id }))
}
