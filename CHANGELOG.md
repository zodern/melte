## 1.5.2 - February 23, 2022

- Update `zodern:melte-compiler`:
  - Fix crash when using old version of Svelte 3

## 1.5.1 - February 12, 2022

- Update `zodern:melte-compiler`:
  - Fix compiling tracker statements for SSR

## 1.5.0 - February 12, 2022

- Update `zodern:melte-compiler`:
  - Fix crash when file has a syntax error
  - Fix source maps. If the svelte file uses typescript, there are still some issues with source maps

## 1.4.5 - December 27, 2021

- Update `zodern:melte-compiler`:
  - Fix loading typescript compiler
  - Fix using `css` option
  - Fix using post css
  - Fix using optional chaining
  - Fix HMR bugs

## 1.4.4 - April 21, 2021

- Fix `Cannot find module 'babylon'` error.

## 1.4.3 - April 21, 2021

- Fix error when svelte options are not in the app's package.json file

## 1.4.2 - April 19, 2021

- Move compiler into its own package, `zodern:melte-compiler` to allow other packages to use and extend it.

## 1.4.1 - April 17, 2021

- Fix errors with the legacy web client

## 1.4.0 - April 17, 2021

- Use typescript with svelte (@r00t3g)
- Fix using HMR with SSR
- Various other improvements and fixes for HMR
- Fix sometimes causing the meteor tool to crash when there is a syntax error in a svelte file

## 1.3.1 - March 25, 2021

- Fix production builds re-using cache entries from development builds

## 1.3.0 - January 18, 2021

- Fix error when updating with HMR fails
