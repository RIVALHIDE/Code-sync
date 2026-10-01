import { FileSystemItem, Id } from "@/types/file"
import { v4 as uuidv4 } from "uuid"

const initialJavaScriptCode = `function sayHi() {
  console.log("👋 Hello world");
}

sayHi()`

const initialPythonCode = `# Python Demo - List Operations
def process_list(numbers):
    """Process a list with various operations"""
    print(f"Original list: {numbers}")
    
    # List operations
    doubled = [x * 2 for x in numbers]
    print(f"Doubled: {doubled}")
    
    filtered = [x for x in numbers if x > 5]
    print(f"Greater than 5: {filtered}")
    
    total = sum(numbers)
    print(f"Sum: {total}")
    
    return doubled

def list_methods_demo():
    """Demonstrate common list methods"""
    fruits = ["apple", "banana", "cherry"]
    print(f"\\nFruits: {fruits}")
    
    # Add items
    fruits.append("orange")
    print(f"After append: {fruits}")
    
    # Remove item
    fruits.remove("banana")
    print(f"After remove: {fruits}")
    
    # Sort
    fruits.sort()
    print(f"Sorted: {fruits}")

# Main execution
if __name__ == "__main__":
    print("👋 Hello from Python!")
    
    numbers = [1, 3, 5, 7, 9, 11]
    process_list(numbers)
    
    list_methods_demo()
    
    # Nested lists
    matrix = [[1, 2], [3, 4], [5, 6]]
    print(f"\\nMatrix: {matrix}")
    print(f"First row: {matrix[0]}")`

const initialCCode = `#include <stdio.h>
#include <string.h>

// Function to greet
void greet(const char* name) {
    printf("👋 Hello, %s!\\n", name);
}

// Function to calculate factorial
int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    greet("C");
    
    // Array demonstration
    int numbers[] = {1, 2, 3, 4, 5};
    int size = sizeof(numbers) / sizeof(numbers[0]);
    
    printf("Numbers: ");
    for (int i = 0; i < size; i++) {
        printf("%d ", numbers[i]);
    }
    printf("\\n");
    
    // Factorial calculation
    int num = 5;
    printf("Factorial of %d = %d\\n", num, factorial(num));
    
    return 0;
}`

const initialCppCode = `#include <iostream>
#include <vector>
#include <string>
using namespace std;

// Class demonstration
class Calculator {
private:
    string name;
public:
    Calculator(string n) : name(n) {}
    
    int add(int a, int b) {
        return a + b;
    }
    
    void greet() {
        cout << "👋 Hello from " << name << "!" << endl;
    }
};

// Function to print vector
void printVector(const vector<int>& vec) {
    cout << "Vector elements: ";
    for (int num : vec) {
        cout << num << " ";
    }
    cout << endl;
}

int main() {
    // Object creation
    Calculator calc("C++");
    calc.greet();
    
    // Vector demonstration
    vector<int> numbers = {1, 2, 3, 4, 5};
    printVector(numbers);
    
    // Calculation
    int sum = calc.add(10, 20);
    cout << "10 + 20 = " << sum << endl;
    
    return 0;
}`

export const initialFileStructure: FileSystemItem = {
    name: "root",
    id: uuidv4(),
    type: "directory",
    children: [
        {
            id: uuidv4(),
            type: "file",
            name: "demo.js",
            content: initialJavaScriptCode,
        },
        {
            id: uuidv4(),
            type: "file",
            name: "demo.py",
            content: initialPythonCode,
        },
        {
            id: uuidv4(),
            type: "file",
            name: "demo.c",
            content: initialCCode,
        },
        {
            id: uuidv4(),
            type: "file",
            name: "demo.cpp",
            content: initialCppCode,
        },
    ],
}

export const findParentDirectory = (
    directory: FileSystemItem,
    parentDirId: Id,
): FileSystemItem | null => {
    // Checking the current directory matches the parentDirName
    if (directory.id === parentDirId && directory.type === "directory") {
        return directory
    }

    // Recursively searching children if it's a directory
    if (directory.type === "directory" && directory.children) {
        for (const child of directory.children) {
            const found = findParentDirectory(child, parentDirId)
            if (found) {
                return found
            }
        }
    }

    // Return null if not found
    return null
}

export const isFileExist = (parentDir: FileSystemItem, name: string) => {
    if (!parentDir.children) return false
    return parentDir.children.some((file) => file.name === name)
}

export const getFileById = (
    fileStructure: FileSystemItem,
    fileId: Id,
): FileSystemItem | null => {
    const findFile = (directory: FileSystemItem): FileSystemItem | null => {
        if (directory.id === fileId) {
            return directory
        } else if (directory.children) {
            for (const child of directory.children) {
                const found = findFile(child)
                if (found) {
                    return found
                }
            }
        }
        return null
    }

    return findFile(fileStructure)
}

export const sortFileSystemItem = (item: FileSystemItem): FileSystemItem => {
    // Recursively sort children if it's a directory
    if (item.type === "directory" && item.children) {
        // Separate directories and files
        let directories = item.children.filter(
            (child) => child.type === "directory",
        )
        const files = item.children.filter((child) => child.type === "file")

        // Sort directories by name (A-Z)
        directories.sort((a, b) => a.name.localeCompare(b.name))

        // Recursively sort nested directories
        directories = directories.map((dir) => sortFileSystemItem(dir))

        // Sort files by name (A-Z)
        files.sort((a, b) => a.name.localeCompare(b.name))

        // Combine sorted directories and files
        item.children = [
            ...directories.filter((dir) => dir.name.startsWith(".")),
            ...directories.filter((dir) => !dir.name.startsWith(".")),
            ...files.filter((file) => file.name.startsWith(".")),
            ...files.filter((file) => !file.name.startsWith(".")),
        ]
    }

    return item
}
