# The codebase for Explanation API is quite large so this repo only tracks modified and constantly/currently used files

## General Picture: 
+ API entry point: bin/www
+ Routes file: routes/ (routes/index.js is used most). Routes switch between different api endpoints so that each URL link is calling different model functions.
+ Model file: model/  (model/expModel.js is used most). Model files are used to call the python code where the heavy-lifting really happens.
+ Python code file: python-code/ (python-code/main.py is used most) Python code fetches the stored explanations from server downey-n2.
