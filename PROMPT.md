ВО ПЕРВЫЙХ БЛЯТЬ, у тебя есть MCP на фигму, на tauri и возможность стучаться в sqlite и тп. 
Ты имеешь доступ к диаграмкам в папке docs. Сейчас мы с тобой ДОЛЖНЫ придумать как нужно сделать это приложение и как его доделть


---

ВАЖНО, что мы сейчас игнорируем логику с plugin funtions, пока-что мы запускам плагин напрямую.
plugin is just one typescript file (just text in db) that exports one default async function that is to be executed by our plugin executor.

---

Our happy path includes:
1. user opens application and sees Open and Create project buttons
2. user opens existing project(or creates new one) and system loads sqlite file, system creates one connection to sqlite project that will be reused later. 
3. Система отображает в левой части экрана (как на примере figma) список сканов, при клике на который отображается их статус и возможность открыть их результаты. For now we just load all scan to frontend when the project is loaded. 
4.
    - При сздании скан имееет статус Draft, в draft скане можно выбраь набор плагинов (исходя из этого будет выбираться какие inputs нужно будет заполнить) и запустить скан. 
    - При запуске скана он получает статус Running, и после завершения становится Completed. В случае ошибки статус становится Failed.
    - МЫ не пказываем промежуточные результаты во время in progress, а показываем их только после завершения скана.
    - по зершении скана мы имеем полностью заполненный объект скана, который отображаем пользователю.


5. Data model - DataModel.md file describes format in which each plugin returns execution results. For now noone checks that plugin actually follows data model, but fronend can only display data model format. Please create respective components in react for types, entities and plugin result as a whole. This data model is the backbone of the plugins and their view on the frontend.


---


Изучи всю кодовую базу, диаграммы, и документацию, чтобы понять текущую архитектуру приложения и его функциональность.
Создавай опросники и уточняющие вопросы, чтобы собрать всю необходимую информацию для разработки приложения.
Как только начинаешь работу над задачей, создавай новый файл в папке tasks, описывай задачу и добавляй информацию о том, что нужно сделать, какие компоненты создать, какие данные использовать и т.д. И по всему что нужно сделать и было сделанно в целом!
формат: /tasks/task-name.md

