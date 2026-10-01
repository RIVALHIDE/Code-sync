import { FileSystemItem } from "@/types/file"
import { v4 as uuidv4 } from "uuid"

// ── helpers ──────────────────────────────────────────────────────────────────

const file = (name: string, content: string): FileSystemItem => ({
    id: uuidv4(),
    name,
    type: "file",
    content,
})

const dir = (name: string, children: FileSystemItem[]): FileSystemItem => ({
    id: uuidv4(),
    name,
    type: "directory",
    children,
    isOpen: true,
})

// ── templates ─────────────────────────────────────────────────────────────────

export interface ProjectTemplate {
    id: string
    label: string
    description: string
    icon: string          // emoji
    category: "web" | "backend" | "systems" | "data" | "mobile"
    children: FileSystemItem[]
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
    // ── Web ──────────────────────────────────────────────────────────────────
    {
        id: "html-css-js",
        label: "HTML / CSS / JS",
        description: "Classic vanilla web app with three separate files",
        icon: "🌐",
        category: "web",
        children: [
            file(
                "index.html",
                `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Hello, World!</h1>
  <script src="app.js"></script>
</body>
</html>`,
            ),
            file(
                "style.css",
                `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

h1 {
  color: #333;
}`,
            ),
            file(
                "app.js",
                `// Entry point
console.log("App loaded ✓");`,
            ),
        ],
    },

    {
        id: "react-ts",
        label: "React + TypeScript",
        description: "Minimal React app with TypeScript and JSX",
        icon: "⚛️",
        category: "web",
        children: [
            dir("src", [
                file(
                    "main.tsx",
                    `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
                ),
                file(
                    "App.tsx",
                    `import React, { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>React + TypeScript</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  )
}`,
                ),
                file(
                    "index.css",
                    `.app {
  font-family: system-ui, sans-serif;
  max-width: 600px;
  margin: 4rem auto;
  text-align: center;
}

button {
  padding: 0.5rem 1.5rem;
  font-size: 1rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  background: #39e079;
  color: #111;
}`,
                ),
            ]),
            file(
                "index.html",
                `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
            ),
            file(
                "tsconfig.json",
                `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true
  }
}`,
            ),
        ],
    },

    {
        id: "node-express",
        label: "Node.js / Express",
        description: "REST API starter with Express and basic routing",
        icon: "🟢",
        category: "backend",
        children: [
            dir("src", [
                file(
                    "index.js",
                    `const express = require("express")
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get("/", (_req, res) => {
  res.json({ message: "Hello, World!" })
})

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`)
})`,
                ),
                dir("routes", [
                    file(
                        "users.js",
                        `const express = require("express")
const router = express.Router()

router.get("/", (_req, res) => {
  res.json({ users: [] })
})

module.exports = router`,
                    ),
                ]),
            ]),
            file(
                "package.json",
                `{
  "name": "express-app",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}`,
            ),
            file(
                ".env",
                `PORT=3000
NODE_ENV=development`,
            ),
            file(
                ".gitignore",
                `node_modules/
.env
dist/`,
            ),
        ],
    },

    {
        id: "python-flask",
        label: "Python / Flask",
        description: "Lightweight Python web server with Flask",
        icon: "🐍",
        category: "backend",
        children: [
            dir("app", [
                file(
                    "__init__.py",
                    `from flask import Flask

def create_app():
    app = Flask(__name__)

    from .routes import main
    app.register_blueprint(main)

    return app`,
                ),
                file(
                    "routes.py",
                    `from flask import Blueprint, jsonify

main = Blueprint("main", __name__)

@main.route("/")
def index():
    return jsonify({"message": "Hello, World!"})`,
                ),
            ]),
            file(
                "run.py",
                `from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)`,
            ),
            file(
                "requirements.txt",
                `flask>=3.0.0
python-dotenv>=1.0.0`,
            ),
            file(
                ".gitignore",
                `__pycache__/
*.pyc
.env
venv/`,
            ),
        ],
    },

    {
        id: "python-script",
        label: "Python Script",
        description: "Simple Python project with main module and utilities",
        icon: "🐍",
        category: "data",
        children: [
            file(
                "main.py",
                `from utils import greet

if __name__ == "__main__":
    message = greet("World")
    print(message)`,
            ),
            file(
                "utils.py",
                `def greet(name: str) -> str:
    """Return a greeting message."""
    return f"Hello, {name}!"`,
            ),
            file(
                "requirements.txt",
                `# Add your dependencies here
# e.g. requests>=2.31.0`,
            ),
        ],
    },

    {
        id: "cpp-cmake",
        label: "C++ / CMake",
        description: "Modern C++ project with CMake build system",
        icon: "⚙️",
        category: "systems",
        children: [
            dir("src", [
                file(
                    "main.cpp",
                    `#include <iostream>
#include "utils.h"

int main() {
    std::cout << greet("World") << std::endl;
    return 0;
}`,
                ),
                file(
                    "utils.h",
                    `#pragma once
#include <string>

std::string greet(const std::string& name);`,
                ),
                file(
                    "utils.cpp",
                    `#include "utils.h"

std::string greet(const std::string& name) {
    return "Hello, " + name + "!";
}`,
                ),
            ]),
            file(
                "CMakeLists.txt",
                `cmake_minimum_required(VERSION 3.16)
project(MyApp VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

add_executable(MyApp
    src/main.cpp
    src/utils.cpp
)`,
            ),
            file(
                ".gitignore",
                `build/
*.o
*.a`,
            ),
        ],
    },

    {
        id: "rust-cargo",
        label: "Rust / Cargo",
        description: "Rust project with a library crate and binary",
        icon: "🦀",
        category: "systems",
        children: [
            dir("src", [
                file(
                    "main.rs",
                    `mod lib;

fn main() {
    let msg = lib::greet("World");
    println!("{}", msg);
}`,
                ),
                file(
                    "lib.rs",
                    `/// Returns a greeting message.
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(greet("World"), "Hello, World!");
    }
}`,
                ),
            ]),
            file(
                "Cargo.toml",
                `[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[dependencies]`,
            ),
            file(
                ".gitignore",
                `/target`,
            ),
        ],
    },

    {
        id: "java-maven",
        label: "Java / Maven",
        description: "Java project with Maven build configuration",
        icon: "☕",
        category: "backend",
        children: [
            dir("src", [
                dir("main", [
                    dir("java", [
                        dir("com", [
                            dir("example", [
                                file(
                                    "Main.java",
                                    `package com.example;

public class Main {
    public static void main(String[] args) {
        System.out.println(Utils.greet("World"));
    }
}`,
                                ),
                                file(
                                    "Utils.java",
                                    `package com.example;

public class Utils {
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
}`,
                                ),
                            ]),
                        ]),
                    ]),
                ]),
            ]),
            file(
                "pom.xml",
                `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
  http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0-SNAPSHOT</version>
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
  </properties>
</project>`,
            ),
        ],
    },

    {
        id: "go-module",
        label: "Go Module",
        description: "Go project with module file and basic HTTP server",
        icon: "🐹",
        category: "backend",
        children: [
            file(
                "main.go",
                `package main

import (
\t"fmt"
\t"net/http"
)

func main() {
\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
\t\tfmt.Fprintln(w, "Hello, World!")
\t})
\tfmt.Println("Server running on http://localhost:8080")
\thttp.ListenAndServe(":8080", nil)
}`,
            ),
            file(
                "go.mod",
                `module example.com/myapp

go 1.21`,
            ),
            file(
                ".gitignore",
                `# Binaries
*.exe
*.out
myapp`,
            ),
        ],
    },

    {
        id: "markdown-docs",
        label: "Documentation Site",
        description: "Markdown documentation project with multiple pages",
        icon: "📝",
        category: "web",
        children: [
            file(
                "README.md",
                `# Project Name

A short description of what this project does.

## Getting Started

See [Installation](docs/installation.md) for setup instructions.

## Usage

See [Usage Guide](docs/usage.md) for examples.`,
            ),
            dir("docs", [
                file(
                    "installation.md",
                    `# Installation

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9

## Steps

\`\`\`bash
git clone https://github.com/your/repo
cd repo
npm install
npm run dev
\`\`\``,
                ),
                file(
                    "usage.md",
                    `# Usage Guide

## Basic Example

\`\`\`js
import { greet } from "./utils"
console.log(greet("World"))
\`\`\``,
                ),
            ]),
        ],
    },
]

export const TEMPLATE_CATEGORIES = [
    { id: "web",      label: "Web",      icon: "🌐" },
    { id: "backend",  label: "Backend",  icon: "🖥️" },
    { id: "systems",  label: "Systems",  icon: "⚙️" },
    { id: "data",     label: "Data/ML",  icon: "📊" },
    { id: "mobile",   label: "Mobile",   icon: "📱" },
] as const
