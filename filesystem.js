const filesystemList = document.querySelector("#filesystem-list");
const filesystemPath = document.querySelector("#filesystem-path");
const filesystemPreviewName = document.querySelector("#filesystem-preview-name");
const filesystemPreviewContent = document.querySelector("#filesystem-preview-content");
const filesystemHome = document.querySelector("#filesystem-home");
const filesystemUp = document.querySelector("#filesystem-up");

const virtualFilesystem = {
  type: "directory",
  children: {
    home: {
      type: "directory",
      children: {
        bits: {
          type: "directory",
          children: {
            "readme.txt": {
              type: "file",
              content: [
                "Welcome to the BitsofBitsofBits virtual filesystem.",
                "",
                "Nothing here is executable, but several files are judgmental.",
                "Try: ls, cd, pwd, cat, or the FILE_EXPLORER.EXE window.",
              ].join("\n"),
            },
            "about.txt": {
              type: "file",
              content: [
                "USER: Caleb K Masters",
                "ALIAS: BitsofBitsofBits",
                "PRONOUNS: they/them",
                "STATUS: probably debugging something",
              ].join("\n"),
            },
            links: {
              type: "directory",
              children: {
                "github.url": {
                  type: "file",
                  content: "https://github.com/BitsofBitsofBitsofBits",
                },
                "linkedin.url": {
                  type: "file",
                  content: "https://www.linkedin.com/in/calebkmasters/",
                },
                "bluesky.url": {
                  type: "file",
                  content: "https://bsky.app/profile/shortbits.net",
                },
              },
            },
            projects: {
              type: "directory",
              children: {
                "shortbits.net": {
                  type: "file",
                  content: [
                    "PROJECT: BitsofBits Website",
                    "STATE: RUNNING",
                    "STACK: HTML, CSS, JavaScript, Supabase",
                    "SOURCE: https://github.com/BitsofBitsofBits/shortbits.net",
                  ].join("\n"),
                },
              },
            },
          },
        },
      },
    },
    etc: {
      type: "directory",
      children: {
        motd: {
          type: "file",
          content: "There are only 10 kinds of people. The rest are edge cases.",
        },
        "hostname": {
          type: "file",
          content: "shortbits.net",
        },
      },
    },
    var: {
      type: "directory",
      children: {
        log: {
          type: "directory",
          children: {
            "boot.log": {
              type: "file",
              content: [
                "avatar.service ........ opinionated",
                "css.questionable ...... enabled",
                "internet.presence ..... online",
                "common_sense.dll ...... not found",
              ].join("\n"),
            },
          },
        },
      },
    },
    dev: {
      type: "directory",
      children: {
        null: {
          type: "file",
          content: "",
        },
        bit: {
          type: "file",
          content: "01000010 01101001 01110100 01110011",
        },
      },
    },
  },
};

let terminalWorkingDirectory = "/home/bits";
let explorerDirectory = "/home/bits";

function normalizeVirtualPath(path, basePath = terminalWorkingDirectory) {
  const source = path.startsWith("/") ? path : `${basePath}/${path}`;
  const segments = [];
  source.split("/").forEach((segment) => {
    if (!segment || segment === ".") {
      return;
    }
    if (segment === "..") {
      segments.pop();
      return;
    }
    segments.push(segment);
  });
  return `/${segments.join("/")}`;
}

function getVirtualNode(path) {
  const normalizedPath = normalizeVirtualPath(path, "/");
  if (normalizedPath === "/") {
    return virtualFilesystem;
  }
  return normalizedPath
    .slice(1)
    .split("/")
    .reduce((node, segment) => node?.children?.[segment], virtualFilesystem);
}

function formatDirectoryEntry(name, node) {
  return `${node.type === "directory" ? "d" : "-"}r--r--r--  bits  ${name}${node.type === "directory" ? "/" : ""}`;
}

function listVirtualDirectory(path) {
  const node = getVirtualNode(path);
  if (!node) {
    return { error: `ls: ${path}: No such file or directory` };
  }
  if (node.type !== "directory") {
    return { lines: [formatDirectoryEntry(path.split("/").pop(), node)] };
  }
  const entries = Object.entries(node.children)
    .sort(([firstName, first], [secondName, second]) => (
      first.type === second.type
        ? firstName.localeCompare(secondName)
        : first.type === "directory" ? -1 : 1
    ));
  return {
    lines: entries.length
      ? entries.map(([name, entry]) => formatDirectoryEntry(name, entry))
      : ["[empty directory]"],
  };
}

function setFilesystemPreview(name, content) {
  filesystemPreviewName.textContent = name;
  filesystemPreviewContent.textContent = content || "[empty file]";
}

function renderFilesystemDirectory(path) {
  const normalizedPath = normalizeVirtualPath(path, explorerDirectory);
  const node = getVirtualNode(normalizedPath);
  if (!node || node.type !== "directory") {
    return false;
  }

  explorerDirectory = normalizedPath;
  filesystemPath.textContent = normalizedPath;
  filesystemList.replaceChildren();
  const entries = Object.entries(node.children).sort(
    ([firstName, first], [secondName, second]) => (
      first.type === second.type
        ? firstName.localeCompare(secondName)
        : first.type === "directory" ? -1 : 1
    ),
  );

  entries.forEach(([name, entry]) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const icon = document.createElement("span");
    const label = document.createElement("strong");
    button.type = "button";
    button.dataset.type = entry.type;
    icon.textContent = entry.type === "directory" ? "[DIR]" : "[FILE]";
    label.textContent = name;
    button.append(icon, label);
    button.addEventListener("click", () => {
      const targetPath = normalizeVirtualPath(name, explorerDirectory);
      if (entry.type === "directory") {
        renderFilesystemDirectory(targetPath);
        setFilesystemPreview(name, "Directory opened.");
      } else {
        setFilesystemPreview(name, entry.content);
      }
    });
    item.append(button);
    filesystemList.append(item);
  });
  filesystemUp.disabled = normalizedPath === "/";
  return true;
}

function handleFilesystemCommand(command) {
  const [operation, ...argumentParts] = command.split(" ");
  const argument = argumentParts.join(" ").trim();

  if (operation === "pwd") {
    return { handled: true, title: command, lines: [terminalWorkingDirectory] };
  }
  if (operation === "ls") {
    const targetPath = normalizeVirtualPath(argument || ".", terminalWorkingDirectory);
    const result = listVirtualDirectory(targetPath);
    return {
      handled: true,
      title: command,
      lines: result.error ? [result.error] : result.lines,
    };
  }
  if (operation === "cd") {
    const targetPath = normalizeVirtualPath(argument || "/home/bits", terminalWorkingDirectory);
    const node = getVirtualNode(targetPath);
    if (!node) {
      return {
        handled: true,
        title: command,
        lines: [`cd: ${argument}: No such file or directory`],
      };
    }
    if (node.type !== "directory") {
      return {
        handled: true,
        title: command,
        lines: [`cd: ${argument}: Not a directory`],
      };
    }
    terminalWorkingDirectory = targetPath;
    renderFilesystemDirectory(targetPath);
    return { handled: true, title: command, lines: [terminalWorkingDirectory] };
  }
  if (operation === "cat") {
    if (!argument) {
      return {
        handled: true,
        title: command,
        lines: ["cat: missing file operand"],
      };
    }
    const targetPath = normalizeVirtualPath(argument, terminalWorkingDirectory);
    const node = getVirtualNode(targetPath);
    if (!node) {
      return {
        handled: true,
        title: command,
        lines: [`cat: ${argument}: No such file or directory`],
      };
    }
    if (node.type !== "file") {
      return {
        handled: true,
        title: command,
        lines: [`cat: ${argument}: Is a directory`],
      };
    }
    return {
      handled: true,
      title: command,
      lines: node.content ? node.content.split("\n") : ["[empty file]"],
    };
  }
  if (operation === "files") {
    window.BITS_DESKTOP_WINDOWS?.open("filesystem");
    renderFilesystemDirectory(terminalWorkingDirectory);
    return {
      handled: true,
      title: command,
      lines: [`FILE_EXPLORER.EXE opened at ${terminalWorkingDirectory}`],
    };
  }
  return { handled: false };
}

filesystemHome.addEventListener("click", () => renderFilesystemDirectory("/home/bits"));
filesystemUp.addEventListener("click", () => {
  renderFilesystemDirectory(normalizeVirtualPath("..", explorerDirectory));
});
window.addEventListener("desktop-window:opened", (event) => {
  if (event.detail?.windowId === "filesystem-window") {
    renderFilesystemDirectory(explorerDirectory);
  }
});

window.BITS_VIRTUAL_FILESYSTEM = {
  handleCommand: handleFilesystemCommand,
  getWorkingDirectory: () => terminalWorkingDirectory,
  open: (path = terminalWorkingDirectory) => {
    const targetPath = normalizeVirtualPath(path, terminalWorkingDirectory);
    const node = getVirtualNode(targetPath);
    if (node?.type === "directory") {
      renderFilesystemDirectory(targetPath);
    } else if (node?.type === "file") {
      renderFilesystemDirectory(normalizeVirtualPath("..", targetPath));
      setFilesystemPreview(targetPath.split("/").pop(), node.content);
    }
    window.BITS_DESKTOP_WINDOWS?.open("filesystem");
  },
};

renderFilesystemDirectory(explorerDirectory);
