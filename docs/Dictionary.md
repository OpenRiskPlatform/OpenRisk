| Name                        | Definition | 
| ------------------------------- | -------------- |
| Investigator                | Primary user of Application - performs investigations in form of Scans |
| Auditor                     | Compliance officer checking/verifying/ensuring that investigation has been done |
| Application                 | Desktop application running on customers PC, contains Projects, used by Investigator | 
| Project                     | Set of Settings, Plugins, Plugin Settings and Scans | 
| Settings                    | e.g. theme, font size, language etc. | 
| Plugin Settings             | e.g. API keys, region, locale, etc. | 
| Scan                        | State of Investigation Process - Plugin Functions | 
| Investigation Process       | Using Plugin Functions to receive Plugin Function Results about the Research Object | 
| Plugin Function             | Functionality for receiving and processing data from the Source. (based on the Plugin Settings and the Plugin Function Inputs, and converting it into Plugin Function Result) | 
| Plugin                      | Set of Plugin Functions of a(the) Source that share Plugin Settings | 
| Research Subject            | !Defined by user | 
| Plugin Function Input       | User specified data that a specific Plugin Function can operate on (e.g. "User Name", "ICO", "Date of Birth", etc.) | 
| Plugin Function Result      | The data obtained using a Plugin Function, with Plugin Function Input and Plugin Settings, converted into the internal (unified) format | 
| Data Source                 | Anything that plugins can retrieve data from. E.g. OpenSanctions, OpenCorporates, Government registers. One Data Source can have many Plugins created for it.
| Scan View                   | One way to represent a single Scan (e.g. PDF report, HTML report, XLSX report, etc.) |
