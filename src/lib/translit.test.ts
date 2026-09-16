import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { toDirectoryQuery } from "./translit";

describe("a Latin query reaches the Ukrainian directory", () => {
  test("a Cyrillic query is left alone", () => {
    assert.equal(toDirectoryQuery("Київ"), "Київ");
    assert.equal(toDirectoryQuery("Відділення"), "Відділення");
  });

  test("a branch number passes through", () => {
    assert.equal(toDirectoryQuery("25"), "25");
  });

  test("the plain letters", () => {
    assert.equal(toDirectoryQuery("Odesa"), "одеса");
    assert.equal(toDirectoryQuery("Sumy"), "суми");
    assert.equal(toDirectoryQuery("Poltava"), "полтава");
    assert.equal(toDirectoryQuery("Rivne"), "рівне");
  });

  test("the digraphs", () => {
    assert.equal(toDirectoryQuery("Kharkiv"), "харків");
    assert.equal(toDirectoryQuery("Zhytomyr"), "житомир");
    assert.equal(toDirectoryQuery("Cherkasy"), "черкаси");
    assert.equal(toDirectoryQuery("Uzhhorod"), "ужгород");
  });

  test("«i» after a vowel is «ї», which is the whole of Kyiv", () => {
    assert.equal(toDirectoryQuery("Kyiv"), "київ");
    assert.equal(toDirectoryQuery("Mykolaiv"), "миколаїв");
  });

  test("«i» after a consonant stays «і»", () => {
    assert.equal(toDirectoryQuery("Dnipro"), "дніпро");
    assert.equal(toDirectoryQuery("Chernihiv"), "чернігів");
  });

  test("an iotated vowel opens a word with «y» and closes one with «i»", () => {
    assert.equal(toDirectoryQuery("Yalta"), "ялта");
    assert.equal(toDirectoryQuery("Vinnytsia"), "вінниця");
    assert.equal(toDirectoryQuery("Zaporizhzhia"), "запоріжжя");
  });

  test("a soft sign before the final consonant is restored", () => {
    assert.equal(toDirectoryQuery("Lutsk"), "луцьк");
    assert.equal(toDirectoryQuery("Donetsk"), "донецьк");
    assert.equal(toDirectoryQuery("Ivano-Frankivsk"), "івано-франківськ");
  });

  test("a soft sign at the very end needs no rule: the directory matches a prefix", () => {
    assert.ok("Тернопіль".toLowerCase().startsWith(toDirectoryQuery("Ternopil")));
    assert.ok("Маріуполь".toLowerCase().startsWith(toDirectoryQuery("Mariupol")));
  });

  test("the names the rules cannot reach are listed by hand", () => {
    assert.equal(toDirectoryQuery("Lviv"), "Львів");
    assert.equal(toDirectoryQuery("Kropyvnytskyi"), "Кропивницький");
  });

  test("a Russian spelling still finds the town", () => {
    assert.equal(toDirectoryQuery("Kiev"), "Київ");
    assert.equal(toDirectoryQuery("Odessa"), "Одеса");
    assert.equal(toDirectoryQuery("Kharkov"), "Харків");
  });

  test("case and padding do not matter", () => {
    assert.equal(toDirectoryQuery("  LVIV  "), "Львів");
    assert.equal(toDirectoryQuery("kHaRkIv"), "харків");
  });
});
