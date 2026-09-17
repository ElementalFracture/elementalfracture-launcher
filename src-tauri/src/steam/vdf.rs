//! Steam's two KeyValues formats.
//!
//! Text (`config.vdf`, `localconfig.vdf`, `libraryfolders.vdf`) is nested
//! quoted pairs; binary (`shortcuts.vdf`) is the same tree with a type byte
//! in front of each key. Both are read into an order-preserving tree and
//! written back whole, so a round trip leaves every entry we didn't touch
//! exactly where Steam put it.

/// A text KeyValues value.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Str(String),
    Obj(Obj),
}

/// An object: pairs in file order. Steam treats keys case-insensitively
/// (`apps` and `Apps` both occur in the wild), so lookups do too.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Obj(pub Vec<(String, Value)>);

impl Obj {
    fn position(&self, key: &str) -> Option<usize> {
        self.0.iter().position(|(k, _)| k.eq_ignore_ascii_case(key))
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        self.position(key).map(|i| &self.0[i].1)
    }

    pub fn str(&self, key: &str) -> Option<&str> {
        match self.get(key) {
            Some(Value::Str(s)) => Some(s),
            _ => None,
        }
    }

    pub fn obj(&self, key: &str) -> Option<&Obj> {
        match self.get(key) {
            Some(Value::Obj(o)) => Some(o),
            _ => None,
        }
    }

    /// Follow a path of object keys.
    pub fn path(&self, keys: &[&str]) -> Option<&Obj> {
        keys.iter().try_fold(self, |o, k| o.obj(k))
    }

    /// Follow a path of object keys, creating (or replacing a string with) an
    /// object at each step that's missing.
    pub fn path_mut(&mut self, keys: &[&str]) -> &mut Obj {
        let mut o = self;
        for k in keys {
            let i = match o.position(k) {
                Some(i) => {
                    if !matches!(o.0[i].1, Value::Obj(_)) {
                        o.0[i].1 = Value::Obj(Obj::default());
                    }
                    i
                }
                None => {
                    o.0.push((k.to_string(), Value::Obj(Obj::default())));
                    o.0.len() - 1
                }
            };
            let Value::Obj(next) = &mut o.0[i].1 else { unreachable!() };
            o = next;
        }
        o
    }

    pub fn set_str(&mut self, key: &str, value: &str) {
        match self.position(key) {
            Some(i) => self.0[i].1 = Value::Str(value.to_string()),
            None => self.0.push((key.to_string(), Value::Str(value.to_string()))),
        }
    }

    #[cfg_attr(windows, allow(dead_code))]
    pub fn remove(&mut self, key: &str) -> Option<Value> {
        self.position(key).map(|i| self.0.remove(i).1)
    }
}

struct Lexer<'a> {
    chars: std::iter::Peekable<std::str::Chars<'a>>,
}

#[derive(Debug, PartialEq)]
enum Token {
    Str(String),
    Open,
    Close,
}

impl Lexer<'_> {
    fn next(&mut self) -> Result<Option<Token>, String> {
        loop {
            match self.chars.peek().copied() {
                None => return Ok(None),
                Some(c) if c.is_whitespace() => {
                    self.chars.next();
                }
                Some('/') => {
                    self.chars.next();
                    if self.chars.peek() != Some(&'/') {
                        return Err("stray '/'".into());
                    }
                    while !matches!(self.chars.next(), None | Some('\n')) {}
                }
                // Platform conditionals (`[$WIN32]`) carry no data.
                Some('[') => {
                    while !matches!(self.chars.next(), None | Some(']')) {}
                }
                Some('{') => {
                    self.chars.next();
                    return Ok(Some(Token::Open));
                }
                Some('}') => {
                    self.chars.next();
                    return Ok(Some(Token::Close));
                }
                Some('"') => {
                    self.chars.next();
                    let mut s = String::new();
                    loop {
                        match self.chars.next() {
                            None => return Err("unterminated string".into()),
                            Some('"') => break,
                            Some('\\') => match self.chars.next() {
                                Some('"') => s.push('"'),
                                Some('\\') => s.push('\\'),
                                Some('n') => s.push('\n'),
                                Some('t') => s.push('\t'),
                                // Not an escape Steam writes: keep it verbatim.
                                Some(other) => {
                                    s.push('\\');
                                    s.push(other);
                                }
                                None => return Err("unterminated string".into()),
                            },
                            Some(c) => s.push(c),
                        }
                    }
                    return Ok(Some(Token::Str(s)));
                }
                Some(_) => {
                    let mut s = String::new();
                    while let Some(&c) = self.chars.peek() {
                        if c.is_whitespace() || matches!(c, '{' | '}' | '"') {
                            break;
                        }
                        s.push(c);
                        self.chars.next();
                    }
                    return Ok(Some(Token::Str(s)));
                }
            }
        }
    }
}

fn parse_pairs(lex: &mut Lexer, nested: bool) -> Result<Obj, String> {
    let mut obj = Obj::default();
    loop {
        let key = match lex.next()? {
            Some(Token::Str(k)) => k,
            Some(Token::Close) if nested => return Ok(obj),
            None if !nested => return Ok(obj),
            Some(Token::Close) => return Err("unexpected '}'".into()),
            Some(Token::Open) => return Err("unexpected '{'".into()),
            None => return Err("unexpected end of file".into()),
        };
        let value = match lex.next()? {
            Some(Token::Str(v)) => Value::Str(v),
            Some(Token::Open) => Value::Obj(parse_pairs(lex, true)?),
            _ => return Err(format!("key {key:?} has no value")),
        };
        obj.0.push((key, value));
    }
}

pub fn parse_text(src: &str) -> Result<Obj, String> {
    let src = src.strip_prefix('\u{feff}').unwrap_or(src);
    parse_pairs(&mut Lexer { chars: src.chars().peekable() }, false)
}

fn quote(s: &str) -> String {
    format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
}

fn write_obj(obj: &Obj, depth: usize, out: &mut String) {
    let indent = "\t".repeat(depth);
    for (k, v) in &obj.0 {
        match v {
            Value::Str(s) => out.push_str(&format!("{indent}{}\t\t{}\n", quote(k), quote(s))),
            Value::Obj(o) => {
                out.push_str(&format!("{indent}{}\n{indent}{{\n", quote(k)));
                write_obj(o, depth + 1, out);
                out.push_str(&format!("{indent}}}\n"));
            }
        }
    }
}

/// Serialise the way Steam does: tab indents, braces on their own lines.
pub fn write_text(obj: &Obj) -> String {
    let mut out = String::new();
    write_obj(obj, 0, &mut out);
    out
}

/// A binary KeyValues value (the types `shortcuts.vdf` uses).
#[derive(Clone, Debug, PartialEq)]
pub enum Bin {
    Obj(BinObj),
    Str(String),
    Int(i32),
    Float(f32),
    U64(u64),
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct BinObj(pub Vec<(String, Bin)>);

impl BinObj {
    pub fn get(&self, key: &str) -> Option<&Bin> {
        self.0.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v)
    }

    pub fn str(&self, key: &str) -> Option<&str> {
        match self.get(key) {
            Some(Bin::Str(s)) => Some(s),
            _ => None,
        }
    }

    pub fn int(&self, key: &str) -> Option<i32> {
        match self.get(key) {
            Some(Bin::Int(i)) => Some(*i),
            _ => None,
        }
    }

    pub fn obj_mut(&mut self, key: &str) -> Option<&mut BinObj> {
        self.0
            .iter_mut()
            .find(|(k, _)| k.eq_ignore_ascii_case(key))
            .and_then(|(_, v)| match v {
                Bin::Obj(o) => Some(o),
                _ => None,
            })
    }

    pub fn set(&mut self, key: &str, value: Bin) {
        match self.0.iter_mut().find(|(k, _)| k.eq_ignore_ascii_case(key)) {
            Some((_, v)) => *v = value,
            None => self.0.push((key.to_string(), value)),
        }
    }
}

const T_OBJ: u8 = 0x00;
const T_STR: u8 = 0x01;
const T_INT: u8 = 0x02;
const T_FLOAT: u8 = 0x03;
const T_U64: u8 = 0x07;
const T_END: u8 = 0x08;

struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}

impl Reader<'_> {
    fn byte(&mut self) -> Result<u8, String> {
        let b = *self.bytes.get(self.at).ok_or("unexpected end of file")?;
        self.at += 1;
        Ok(b)
    }

    fn take<const N: usize>(&mut self) -> Result<[u8; N], String> {
        let slice = self.bytes.get(self.at..self.at + N).ok_or("unexpected end of file")?;
        self.at += N;
        Ok(slice.try_into().unwrap())
    }

    fn cstr(&mut self) -> Result<String, String> {
        let rest = &self.bytes[self.at..];
        let len = rest.iter().position(|&b| b == 0).ok_or("unterminated string")?;
        let s = String::from_utf8_lossy(&rest[..len]).into_owned();
        self.at += len + 1;
        Ok(s)
    }

    fn obj(&mut self, top: bool) -> Result<BinObj, String> {
        let mut obj = BinObj::default();
        loop {
            if top && self.at == self.bytes.len() {
                return Ok(obj);
            }
            let ty = self.byte()?;
            if ty == T_END {
                return Ok(obj);
            }
            let key = self.cstr()?;
            let value = match ty {
                T_OBJ => Bin::Obj(self.obj(false)?),
                T_STR => Bin::Str(self.cstr()?),
                T_INT => Bin::Int(i32::from_le_bytes(self.take()?)),
                T_FLOAT => Bin::Float(f32::from_le_bytes(self.take()?)),
                T_U64 => Bin::U64(u64::from_le_bytes(self.take()?)),
                other => return Err(format!("unknown value type 0x{other:02x}")),
            };
            obj.0.push((key, value));
        }
    }
}

pub fn parse_binary(bytes: &[u8]) -> Result<BinObj, String> {
    Reader { bytes, at: 0 }.obj(true)
}

fn write_bin_obj(obj: &BinObj, out: &mut Vec<u8>) {
    for (k, v) in &obj.0 {
        let ty = match v {
            Bin::Obj(_) => T_OBJ,
            Bin::Str(_) => T_STR,
            Bin::Int(_) => T_INT,
            Bin::Float(_) => T_FLOAT,
            Bin::U64(_) => T_U64,
        };
        out.push(ty);
        out.extend_from_slice(k.as_bytes());
        out.push(0);
        match v {
            Bin::Obj(o) => {
                write_bin_obj(o, out);
                out.push(T_END);
            }
            Bin::Str(s) => {
                out.extend_from_slice(s.as_bytes());
                out.push(0);
            }
            Bin::Int(i) => out.extend_from_slice(&i.to_le_bytes()),
            Bin::Float(f) => out.extend_from_slice(&f.to_le_bytes()),
            Bin::U64(u) => out.extend_from_slice(&u.to_le_bytes()),
        }
    }
}

pub fn write_binary(obj: &BinObj) -> Vec<u8> {
    let mut out = Vec::new();
    write_bin_obj(obj, &mut out);
    out.push(T_END);
    out
}

#[cfg(test)]
#[path = "__tests/vdf.rs"]
mod tests;
