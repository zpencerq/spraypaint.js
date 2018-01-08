import { expect, sinon } from '../test-helper';
import { JSORMBase } from '../../src/model'
import { hasOne } from '../../src/associations'
import { attr } from '../../src/attribute'
import { JsonapiTypeRegistry } from '../../src/jsonapi-type-registry'
import { StorageBackend } from '../../src/local-storage';

import {
  ApplicationRecord,
  Person,
  Book,
  Author,
  Genre,
  Bio
} from '../fixtures';

import { 
  Model, 
  Attr,
  HasOne, 
  HasMany, 
  BelongsTo, 
} from '../../src/decorators'

// Accessing private property in unit tests so we need a type-loose conversion function
const modelAttrs = (model : JSORMBase) : Record<string, any> => (<any>model)._attributes 

describe('Model', () => {
  describe('Class Creation/Initialization', () => {
    describe('Typescript Classes + Decorators API', () => {
      describe('Base Class', () => {
        let BaseClass : typeof JSORMBase
        let SubClass : typeof JSORMBase

        beforeEach(() => {
          @Model()
          class TestBase extends JSORMBase {}
          BaseClass = TestBase

          @Model()
          class ChildModel extends BaseClass {}
          SubClass = ChildModel
        })

        it('creates a new model types registry', () => {
          expect((<any>JSORMBase)._typeRegistry).to.be.undefined
          expect(BaseClass.typeRegistry).to.be.instanceOf(JsonapiTypeRegistry)
        })
        
        it('sets the model as a new base class', () => {
          expect(BaseClass.isBaseClass).to.be.true
          expect(BaseClass.baseClass).to.eq(BaseClass)
        })
        
        it('allows child classes to get a reference to their base', () => {

          expect(SubClass.isBaseClass).to.be.false
          expect(SubClass.baseClass).to.eq(BaseClass)
        })

        describe('#getJWT', () => {
          beforeEach(() => {
            BaseClass.jwt = 'g3tm3';
          });

          it('it grabs jwt from top-most parent', () => {
            expect(SubClass.getJWT()).to.eq('g3tm3');
          });

          describe('when no JWT owner', () => {
            it('returns undefined', () => {
              @Model()
              class NoJWT extends JSORMBase {}

              expect(NoJWT.getJWT()).to.eq(undefined);
            });
          });
        });

        describe('#setJWT', () => {
          it('it sets jwt on the base class', () => {
            SubClass.setJWT('n3wt0k3n');
            expect(BaseClass.jwt).to.eq('n3wt0k3n');
          });
          
          context('when user attempts to set jwt on JSORMBase', () => {
            it('throws an error', () => {
              expect(() => {
                JSORMBase.setJWT('foobar')
              }).to.throw(/Cannot set JWT on JSORMBase/)
            })
          })

          describe('when localStorage is configured', function() {
            let backend : StorageBackend
            let BaseClass : typeof JSORMBase

            const buildModel = () => {
              // need new class for this since it needs initialization to have the jwt config set
              @Model({
                jwtLocalStorage: 'MyJWT',
                localStorageBackend: backend, // Cast to any since we don't want this to be part of the standard model config interface. Just for test stubbing purposes
              } as any)
              class Base extends JSORMBase {}
              BaseClass = Base
            }

            describe('JWT Updates', () => {
              beforeEach(() => {
                backend = {
                  setItem: sinon.spy(),
                  getItem: sinon.spy()
                }
                buildModel()
              })

              it('adds to localStorage', function() {
                BaseClass.setJWT('n3wt0k3n');
                expect(backend.setItem).to.have.been.calledWith('MyJWT', 'n3wt0k3n');
              })
            })

            describe('JWT Initialization', () => {
              beforeEach(() => {
                backend = {
                  setItem: sinon.spy(),
                  getItem: sinon.stub().returns('or!g!nalt0k3n')
                }
                buildModel()
              })

              it('sets the token correctly', function() {
                expect(BaseClass.getJWT()).to.equal('or!g!nalt0k3n')
              })

              it('does not set it on the base class or other sibling classes', function() {
                expect(JSORMBase.getJWT()).to.equal(undefined)
                expect(ApplicationRecord.getJWT()).to.equal(undefined)
              })
            })
          })
        });
      })

      @Model()
      class BaseModel extends JSORMBase {}

      @Model()
      class Post extends BaseModel {
        @Attr title : string
        @BelongsTo({type: Person}) author : Person

        screamTitle(exclamationPoints: number) : string {
          let loudness : string = ''

          for(let i = 0; i < exclamationPoints; i++) {
            loudness += '!'
          }

          return `${this.title.toUpperCase()}${loudness}`
        }
      }

      it('sets up expected inheritance hierarchy', () => {
        expect(Post.currentClass).to.equal(Post)
        expect(Post.parentClass).to.equal(BaseModel)
        expect(Post.isBaseClass).to.be.false
        let instance = new Post()

        expect((<any>instance).klass).to.eq(Post)
      })

      it('sets a default jsonapi type', () => {
        @Model()
        class TestType extends BaseModel { }

        expect(TestType.jsonapiType).to.eq('test_types')
      })

      it('obeys explicit jsonapi type', () => {
        @Model({jsonapiType: "my_type"})
        class TestType extends BaseModel { }

        expect(TestType.jsonapiType).to.eq('my_type')
      })

      it('adds the instance to the type registry', () => {
        expect(BaseModel.typeRegistry.get('posts')).to.equal(Post)
      })

      it('correctly instantiates the model', () => {
        let theAuthor = new Person()
        let post  = new Post({title: 'The Title', author: theAuthor, id: '1234'})

        expect(post.author).to.equal(theAuthor)
        expect(post.screamTitle(3)).to.equal('THE TITLE!!!')
        expect(post.id).to.equal('1234')
      })

      it('sets up attribute getters/setters', () => {
        let post  = new Post({title: 'The Title'})

        expect(modelAttrs(post)).to.deep.equal({
          title: 'The Title'
        })

        post.title = 'new title'

        expect(modelAttrs(post)).to.deep.equal({
          title: 'new title'
        })
        expect(post.screamTitle(3)).to.equal('NEW TITLE!!!')
      })

      describe('model inheritence', () => {
        @Model()
        class FrontPagePost extends Post {
          @Attr() pageOrder: number

          isFirst() {
            return this.pageOrder === 1
          }
        }

        it('sets up expected inheritance hierarchy', () => {
          expect(FrontPagePost.currentClass).to.equal(FrontPagePost)
          expect(FrontPagePost.parentClass).to.equal(Post)
          expect(FrontPagePost.isBaseClass).to.be.false
          let instance = new FrontPagePost()

          expect((<any>instance).klass).to.eq(FrontPagePost)
        })

        it('allows extension of the model', () => { 
          let post = new FrontPagePost({title: 'The Title' , pageOrder: 1})

          expect(post.screamTitle(3)).to.equal('THE TITLE!!!')
          expect(post.isFirst()).to.be.true
        })

        it('does not modify the parent attributes', () => { 
          let post = new Post({title: 'The Title' , pageOrder: 1})

          expect(modelAttrs(post).pageOrder).to.be.undefined
        })
      })

      describe('model inheritence with .extends() API', () => {
        const FrontPagePost = Post.extend({
          attrs: {
            pageOrder: attr({type: Number})
          },
          methods: {
            isFirst() {
              return this.pageOrder === 1
            }
          }
        })

        it('allows extension of the model', () => {
          let post  = new FrontPagePost({title: 'The Title' , pageOrder: 1})

          expect(post.screamTitle(3)).to.equal('THE TITLE!!!')
          expect(post.isFirst()).to.be.true
        })
      })

    })

    describe('.extend() API', () => {
      const BaseModel = JSORMBase.extend({

      })

      const Person = BaseModel.extend({
        attrs: {
          name: attr({ type: String })
        }
      })

      const Post = BaseModel.extend({
        static: {
          jsonapiType: 'posts'
        },
        attrs: {
          title: attr({ type: String }),
          author: hasOne({ type: Person })
        },
        methods: {
          screamTitle(exclamationPoints: number) : string {
            let loudness : string = ''

            for(let i = 0; i < exclamationPoints; i++) {
              loudness += '!'
            }

            return `${this.title.toUpperCase()}${loudness}`
          },
          other() : boolean {
            return true
          }
        }
      })

      it('sets up expected inheritance hierarchy', () => {
        expect(Post.currentClass).to.equal(Post)
        expect(Post.parentClass).to.equal(BaseModel)
        expect(Post.isBaseClass).to.be.false
        let instance = new Post()

        expect((<any>instance).klass).to.eq(Post)
      })

      it('obeys explicit jsonapi type', () => {
        expect(Post.jsonapiType).to.eq('posts')
      })

      it('adds the instance to the type registry', () => {
        expect(BaseModel.typeRegistry.get('posts')).to.equal(Post)
      })

      it('correctly instantiates the model', () => {
        let theAuthor = new Person({name: 'fred'})
        let post = new Post({title: 'The Title', author: theAuthor, id: '1234'})

        expect(post.author).to.equal(theAuthor)
        expect(post.screamTitle(3)).to.equal('THE TITLE!!!')
        expect(post.id).to.equal('1234')
      })

      it('sets up attribute getters/setters', () => {
        let post  = new Post({title: 'The Title'})

        expect(modelAttrs(post)).to.deep.equal({
          title: 'The Title'
        })

        post.title = 'new title'

        expect(modelAttrs(post)).to.deep.equal({
          title: 'new title'
        })
        expect(post.screamTitle(3)).to.equal('NEW TITLE!!!')
      })

      describe('model inheritence', () => {
        const FrontPagePost = Post.extend({
          attrs: {
            pageOrder: attr({type: Number})
          },
          methods: {
            isFirst() {
              return this.pageOrder === 1
            }
          }
        })

        it('sets up expected inheritance hierarchy', () => {
          expect(FrontPagePost.currentClass).to.equal(FrontPagePost)
          expect(FrontPagePost.parentClass).to.equal(Post)
          expect(Post.isBaseClass).to.be.false
          let instance = new FrontPagePost()

          expect((<any>instance).klass).to.eq(FrontPagePost)
        })

        it('allows extension of the model', () => {
          let post  = new FrontPagePost({title: 'The Title' , pageOrder: 1})


          expect(post.screamTitle(3)).to.equal('THE TITLE!!!')
          expect(post.isFirst()).to.be.true
        })

        it('does not modify the parent attributes', () => { 
          let post = new Post({title: 'The Title' , pageOrder: 1})

          expect(modelAttrs(post)['pageOrder']).to.be.undefined
        })
      })

      /*
       *
       * While the underlying javascript functions correctly, the
       * current type definitions for the JSORMBase.extend() API
       * don't allow for declaring a typescript class based on a
       * class created from extend().  This was originally working,
       * but the type definitions were VERY complicated, and in
       * simplifying them, it was necessary to omit the case
       * where one was going FROM javascript TO typescript,
       * which seems like a far edge case when there aren't any 
       * type definitions exported by the library as well, so I'm
       * punting on it for now until I figure out a typings fix. 
       * 
       * Keeping the tests around with a lot of coercion to verify
       * the underlying functionality still works from a JS-only
       * perspective.
       * 
       */
      describe('inheritance with class-based declaration', () => {
        class ExtendedPost extends (<any>Post) {
          // @Attr pageOrder : number
          pageOrder : number

          isFirst() {
            return this.pageOrder === 1
          }
        }
        Model(ExtendedPost as any)
        Attr(ExtendedPost as any, 'pageOrder')
        const FrontPagePost : any = ExtendedPost
        

        it('allows extension of the model', () => {
          let post  = new FrontPagePost({title: 'The Title' , pageOrder: 1})

          expect(post.screamTitle(3)).to.equal('THE TITLE!!!')
          expect(post.isFirst()).to.be.true
        })

        it('does not modify the parent attributes', () => { 
          let post = new Post({title: 'The Title' , pageOrder: 1})

          expect(modelAttrs(post)['pageOrder']).to.be.undefined
        })
      })

      describe('class options', () => {
        let config = {
          apiNamespace: 'api/v1',
          jwt: 'abc123', 
        }

        let MyModel = BaseModel.extend({
          static: config
        })

        it('preserves defaults for unspecified items', () => {
          expect(MyModel.baseUrl).to.eq('http://please-set-a-base-url.com')
          expect(MyModel.camelizeKeys).to.be.true
        })

        it('correctly assigns options', () => {
          expect(MyModel.apiNamespace).to.eq(config.apiNamespace)
          expect(MyModel.jwt).to.eq(config.jwt)
        })

        it('does not override parent class options', () => {
          expect(BaseModel.apiNamespace).not.to.eq(config.apiNamespace)
          expect(BaseModel.jwt).not.to.eq(config.jwt)
        })
      })
    })

    describe('Instance Behavior', () => {
      describe('isMarkedForDestruction', () => {
        it('toggles correctly', () => {
          let instance = new Author();
          expect(instance.isMarkedForDestruction).to.eq(false)
          instance.isMarkedForDestruction = true
          expect(instance.isMarkedForDestruction).to.eq(true)
          instance.isMarkedForDestruction = false
          expect(instance.isMarkedForDestruction).to.eq(false)
        });
      });

      describe('isMarkedForDisassociation', () => {
        it('toggles correctly', () => {
          let instance = new Author();
          expect(instance.isMarkedForDisassociation).to.eq(false)
          instance.isMarkedForDisassociation = true
          expect(instance.isMarkedForDisassociation).to.eq(true)
          instance.isMarkedForDisassociation = false
          expect(instance.isMarkedForDisassociation).to.eq(false)
        });
      });

      describe('#isType', () => {
        it('checks the jsonapiType of class', () => {
          let instance = new Author()
          expect(instance.isType('authors')).to.eq(true)
          expect(instance.isType('people')).to.eq(false)
        });
      });

    })
  })

  describe('#fromJsonapi', () => {
    let doc = {
      data: {
        id: '1',
        type: 'authors',
        attributes: {
          firstName: 'Donald Budge',
          unknown: 'adsf',
          nilly: null
        },
        relationships: {
          unknownrelationship: {
            data: {
              id: '1',
              type: 'unknowns'
            }
          },
          multi_words: {
            data: [{
              id: '1',
              type: 'multi_words'
            }]
          },
          tags: {},
          genre: {
            data: {
              id: '1',
              type: 'genres'
            }
          },
          books: {
            data: [{
              id: '1',
              type: 'books'
            }, {
              id: '2',
              type: 'books'
            }]
          },
          special_books: {
            data: [{
              id: '3',
              type: 'books'
            }]
          },
          bio: {
            data: {
              id: '1',
              type: 'bios'
            }
          }
        },
        meta: {
          big: true
        }
      },
      included: [
        {
          type: 'books',
          id: '1',
          attributes: {
            title: "Where's My Butt?"
          },
          relationships: {
            author: {
              data: {
                id: '2',
                type: 'authors' 
              },
            }
          }
        },
        {
          type: 'books',
          id: '2',
          attributes: {
            title: "Catcher in the Rye"
          },
          relationships: {
            author: {
              data: { 
                id: '2', 
                type: 'authors' 
              },
            }
          }
        },
        {
          type: 'books',
          id: '3',
          attributes: {
            title: "Peanut Butter & Cupcake"
          }
        },
        {
          type: 'genres',
          id: '1',
          attributes: {
            name: "Children's"
          },
          relationships: {
            authors: {
              data: [
                { id: '1', type: 'authors' },
                { id: '2', type: 'authors' }
              ]
            }
          }
        },
        {
          type: 'authors',
          id: '2',
          attributes: {
            firstName: 'Maurice Sendak'
          }
        },
        {
          type: 'bios',
          id: '1',
          attributes: {
            description: 'Some Dude.'
          }
        }
      ]
    };

    it('assigns id correctly', () => {
      let instance = new Author();
      instance.fromJsonapi(doc.data, doc);
      expect(instance.id).to.eq('1');
    });

    it('instantiates the correct model for jsonapi type', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance).to.be.instanceof(Author);
    });

    it('assigns attributes correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance.firstName).to.eq('Donald Budge');
      expect(instance.attributes).to.eql({
        firstName: 'Donald Budge',
        nilly: null
      })
    });

    it('camelizes relationship names', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance.multiWords.length).to.eq(1);
    });

    it('does not assign unknown attributes', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance).to.not.have.property('unknown');
    });

    it('does not assign unknown relationships', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance).to.not.have.property('unknownrelationship');
    });

    it('does not blow up on null attributes', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance.nilly).to.eq(null);
    });

    it('assigns metadata correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc);
      expect(instance.__meta__).to.eql({
        big: true
      })
    });

    it('assigns hasMany relationships correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      expect(instance.books.length).to.eq(2)
      let book = instance.books[0]
      expect(book).to.be.instanceof(Book)
      expect(book.title).to.eq("Where's My Butt?"); 
    })

    it('assigns hasMany relationships with same jsonapiType correctly', () => { 
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      expect(instance.specialBooks.length).to.eq(1)
      let book = instance.specialBooks[0]
      expect(book).to.be.instanceof(Book)
      expect(book.title).to.eq("Peanut Butter & Cupcake")
    })

    it('assigns belongsTo relationships correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      let genre = instance.genre
      expect(genre).to.be.instanceof(Genre)
      expect(genre.name).to.eq("Children's")
    });

    it('assigns hasOnModelnships correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      let bio = instance.bio
      expect(bio).to.be.instanceof(Bio)
      expect(bio.description).to.eq("Some Dude.")
    });

    it('assigns neste relationships correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      let authors = instance.genre.authors
      expect(authors.length).to.eq(2)
      expect(authors[0]).to.be.instanceof(Author)
      expect(authors[1]).to.be.instanceof(Author)
      expect(authors[0].firstName).to.eq('Donald Budge')
      expect(authors[1].firstName).to.eq('Maurice Sendak');
    });

    it('assigns duplicated nested relationships correctly', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      let book1 = instance.books[0]
      let book2 = instance.books[1]

      expect(book1.author.firstName).to.eq("Maurice Sendak")
      expect(book2.author.firstName).to.eq("Maurice Sendak")
    })

    it('skips relationships without data', () => {
      let instance = ApplicationRecord.fromJsonapi(doc.data, doc)
      expect(instance.tags).to.eql([])
    });

    it('preserves other properties on the object', () => {
      let instance : any = new Author({ id: '1' });
      instance['fooble'] = 'bar';
      let same = instance.fromJsonapi(doc.data, doc);
      expect(same).to.eq(instance);

      expect(instance.id).to.eq('1');
      expect(instance.firstName).to.eq('Donald Budge');
      expect(instance['fooble']).to.eq('bar');
    });
 
    it('preserves other properties on relationships', () => {
      let genre : any = new Genre({ id: '1' });
      genre['bar'] = 'baz'
      let book : any = new Book({ id: '1', genre: genre });
      book['foo'] = 'bar'
      let instance : any= new Author({ id: '1', books: [book] });
      instance.fromJsonapi(doc.data, doc);

      expect(instance.books[0]).to.eq(book);
      expect(instance.books[0].genre).to.eq(genre);

      expect(book.title).to.eq("Where's My Butt?");
      expect(book['foo']).to.eq('bar');
      expect(genre['bar']).to.eq('baz');
    })
  })

  describe('changes', () => {
    describe('when unpersisted', () => {
      it('counts everything but nulls', () => {
        let instance = new Author({ firstName: 'foo' });
        expect(instance.changes()).to.deep.equal({
          firstName: [null, 'foo']
        });
      });
    });

    describe('when persisted', () => {
      it('only counts dirty attrs', () => {
        let instance = new Author({ firstName: 'foo' });
        instance.isPersisted = true
        expect(instance.changes()).to.deep.equal({});
        instance.firstName = 'bar'

        expect(instance.changes()).to.deep.equal({
          firstName: ['foo', 'bar']
        });
        instance.isPersisted = true
        expect(instance.changes()).to.deep.equal({});
      });
    });
  });

  describe('isDirty', () => {
    describe('when an attribute changes', () => {
      it('is marked as dirty', () => {
        let instance = new Author();
        instance.isPersisted = true
        expect(instance.isDirty()).to.eq(false);
        instance.firstName = 'Joe';
        expect(instance.isDirty()).to.eq(true);
        instance.isPersisted = true
      });
    });

    describe('when not persisted', () => {
      describe('and no attributes', () => {
        it('is not dirty', () => {
          let instance = new Author();
          expect(instance.isDirty()).to.eq(false);
        });
      });

      describe('and has attributes', () => {
        it('is dirty', () => {
          let instance = new Author({ firstName: 'Stephen' });
          expect(instance.isDirty()).to.eq(true);
          instance.isPersisted = true
          expect(instance.isDirty()).to.eq(false);
        });
      });
    });

    describe('when dirty, then persisted', () => {
      it('is no longer dirty', () => {
        let instance = new Author();
        instance.firstName = 'foo';
        expect(instance.isDirty()).to.eq(true);
      });
    });

    describe('when marked for destruction', () => {
      it('is dirty', () => {
        let instance = new Author();
        instance.isPersisted = true
        expect(instance.isDirty()).to.eq(false);
        instance.isMarkedForDestruction = true
        expect(instance.isDirty()).to.eq(true);
      });
    });

    describe('when marked for disassociation', () => {
      it('is dirty', () => {
        let instance = new Author();
        instance.isPersisted = true
        expect(instance.isDirty()).to.eq(false);
        instance.isMarkedForDisassociation = true
        expect(instance.isDirty()).to.eq(true);
      });
    });

    describe('when passed relationships', () => {
      let instance : Author

      beforeEach(() => {
        let book = new Book({ id: 1, title: 'original' });
        instance = new Author({ books: [book] });
      });

      it('works with string/object/array include graph', () => {
        instance.books[0].isPersisted = true
        let authorGenre = new Genre({ id: 1 })
        let bookGenre = new Genre({ id: 2 })
        authorGenre.isPersisted = true
        bookGenre.isPersisted = true
        instance.books[0].genre = bookGenre
        instance.genre = authorGenre
        instance.books[0].isPersisted = true
        instance.isPersisted = true

        let check = () => {
          return instance.isDirty(['genre', { books: 'genre' }]);
        }

        expect(check()).to.eq(false);
        instance.genre.name = 'changed';
        expect(check()).to.eq(true);
        instance.genre.isPersisted = true

        expect(check()).to.eq(false);
        instance.books[0].title = 'changed';
        expect(check()).to.eq(true);
        instance.books[0].isPersisted = true

        expect(check()).to.eq(false);
        instance.books[0].genre.name = 'changed';
        expect(check()).to.eq(true);
      });

      it('is not dirty when relationship not passed, even if relationship is dirty', () => {
        instance.books[0].isPersisted = true
        instance.isPersisted = true

        expect(instance.isDirty('genre')).to.eq(false);
        expect(instance.isDirty('books')).to.eq(false);
        instance.books[0].title = 'dirty';
        expect(instance.isDirty('books')).to.eq(true);
        expect(instance.isDirty('genre')).to.eq(false);
      });

      describe('when a hasMany relationship adds a new unpersisted member', () => {
        it('is dirty', () => {
          instance.books = [];
          instance.isPersisted = true
          expect(instance.isDirty('books')).to.eq(false);
          instance.books.push(new Book({ title: 'asdf' }));
          expect(instance.isDirty('books')).to.eq(true);
        });
      });

      describe('when a hasMany relationship adds a new persisted member', () => {
        it('is dirty', () => {
          let instance = new Author({ id: 1 });
          instance.isPersisted = true
          instance.books = [];
          instance.isPersisted = true
          expect(instance.isDirty('books')).to.eq(false);
          let book = new Book({ id: 99 });
          book.isPersisted = true
          instance.books.push(book);

          expect(instance.isDirty('books')).to.eq(true);
          instance.isPersisted = true
          expect(instance.isDirty('books')).to.eq(false);
        });
      });

      describe('when a belongsTo changes a persisted member', () => {
        it('is dirty', () => {
          let instance = new Author();
          let genre = new Genre({ id: 1 });
          genre.isPersisted = true
          let otherGenre = new Genre({ id: 2 });
          otherGenre.isPersisted = true

          instance.genre = genre
          instance.isPersisted = true

          expect(instance.isDirty()).to.eq(false);
          instance.genre = otherGenre;
          expect(instance.isDirty('genre')).to.eq(true);
          expect(instance.isDirty()).to.eq(false);

          instance.isPersisted = true
          expect(instance.isDirty('genre')).to.eq(false);
        });
      });

      describe('when a hasMany relationship has a member marked for destruction', () => {
        it('is dirty', () => {
          let book = new Book({ id: 1 });
          book.isPersisted = true
          instance.books = [book];
          instance.isPersisted = true

          expect(instance.isDirty('books')).to.eq(false);
          book.isMarkedForDestruction = true
          expect(instance.isDirty('books')).to.eq(true);
          expect(instance.isDirty()).to.eq(false);
        });
      });

      describe('when a hasMany relationship has a member marked for disassociation', () => {
        it('is dirty', () => {
          let book = new Book({ id: 1 });
          book.isPersisted = true
          instance.books = [book];
          instance.isPersisted = true

          expect(instance.isDirty('books')).to.eq(false);
          book.isMarkedForDisassociation = true
          expect(instance.isDirty('books')).to.eq(true);
          expect(instance.isDirty()).to.eq(false);
        });
      });
    });

    describe('when a has-many is marked for destruction', () => {
      let newDoc : JsonapiResponseDoc
      let instance : Author
      let book : Book

      beforeEach(() => {
        book = new Book({ id: '1' });
        book.isPersisted = true
        book.isMarkedForDestruction = true

        instance = new Author({ books: [book] });

        newDoc = {
          data: {
            id: '1',
            type: 'authors'
          }
        }
      });

      describe('when the relation is part of the include directive', () => {
        it('is removed from the array', () => {
          expect(instance.books.length).to.eq(1);
          instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, { books: {} });
          expect(instance.books.length).to.eq(0);
        });
      });

      describe('when the relation is not part of the include directive', () => {
        it('is NOT removed from the array', () => {
          expect(instance.books.length).to.eq(1);
          instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, {});
          expect(instance.books.length).to.eq(1);
        });
      });
    });

    describe('when a has-many is marked for disassociation', () => {
      let newDoc : JsonapiResponseDoc
      let instance : Author
      let book : Book

      beforeEach(() => {
        book = new Book({ id: '1' });
        book.isPersisted = true
        book.isMarkedForDisassociation = true

        instance = new Author({ books: [book] });

        newDoc = {
          data: {
            id: '1',
            type: 'authors'
          }
        }
      });

      describe('when the relation is part of the include directive', () => {
        it('is removed from the array', () => {
          expect(instance.books.length).to.eq(1);
          instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, { books: {} });
          expect(instance.books.length).to.eq(0);
        });
      });

      describe('when the relation is not part of the include directive', () => {
        it('is NOT removed from the array', () => {
          expect(instance.books.length).to.eq(1);
          instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, {});
          expect(instance.books.length).to.eq(1);
        });
      });
    });

    describe('when a belongs-to is marked for destruction', function() {
      let newDoc : JsonapiResponseDoc
      let instance : Author
      let book : Book

      beforeEach(function() {
        let genre = new Genre({ id: '1' });
        genre.isPersisted = true
        genre.isMarkedForDestruction = true

        book = new Book({ id: '1', genre: genre });
        book.isPersisted = true

        instance = new Author({ books: [book] });

        newDoc = {
          data: {
            id: '1',
            type: 'authors',
            relationships: {
              books: {
                data: [
                  { id: '1', type: 'books' }
                ]
              }
            },
          },
          included: [
            {
              id: '1',
              type: 'books',
              attributes: { title: 'whatever' }
            }
          ]
        }
      });

      it('is set to null', function() {
        expect(instance.books[0].genre).to.be.instanceof(Genre);
        instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, { books: { genre: {} }});
        expect(instance.books[0].genre).to.eq(null);
      });

      describe('within a nested destruction', function() {
        beforeEach(function() {
          book.isMarkedForDestruction = true
        });

        it('is removed via the parent', function() {
          instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, { books: { genre: {} }});
          expect(instance.books.length).to.eq(0);
        });
      });
    });

    describe('when a belongs-to is marked for disassociation', function() {
      let newDoc : JsonapiResponseDoc
      let instance : Author
      let book : Book


      beforeEach(function() {
        let genre = new Genre({ id: '1' });
        genre.isPersisted = true
        genre.isMarkedForDisassociation = true

        book = new Book({ id: '1', genre: genre });
        book.isPersisted = true

        instance = new Author({ books: [book] });

        newDoc = {
          data: {
            id: '1',
            type: 'authors',
            relationships: {
              books: {
                data: [
                  { id: '1', type: 'books' }
                ]
              }
            },
          },
          included: [
            {
              id: '1',
              type: 'books',
              attributes: { title: 'whatever' }
            }
          ]
        }
      });

      it('is set to null', function() {
        expect(instance.books[0].genre).to.be.instanceof(Genre);
        instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, { books: { genre: {} }});
        expect(instance.books[0].genre).to.eq(null);
      });

      describe('within a nested destruction', function() {
        beforeEach(function() {
          book.isMarkedForDisassociation = true
        });

        it('is removed via the parent', function() {
          instance.fromJsonapi(newDoc.data as JsonapiResource, newDoc, { books: { genre: {} }});
          expect(instance.books.length).to.eq(0);
        });
      });
    });
  })

  describe('#relationshipResourceIdentifiers()', () => {
    @Model()
    class RelationGraph extends ApplicationRecord {
      @BelongsTo({type: Author}) author : Author
      @HasMany({type: Book}) books : Book
      @HasOne({type: Bio}) bio : Bio
    }

    let instance : RelationGraph

    describe('when no relations set', () => {
      it('is empty', () => {
        instance = new RelationGraph();
        let relationNames = Object.keys(instance.relationships);
        expect(instance.relationshipResourceIdentifiers(relationNames))
          .to.deep.equal({});
      });
    });

    describe('when relations set', () => {
      it('returns correct object', () => {
        let author = new Author({ id: 1 });
        author.isPersisted = true
        let book = new Book({ id: 1 });
        book.isPersisted = true
        let bio = new Bio({ id: 1 });
        bio.isPersisted = true
        instance = new RelationGraph({ author, bio, books: [book] })
        let relationNames = Object.keys(instance.relationships);
        expect(instance.relationshipResourceIdentifiers(relationNames)).to.deep.equal({
          author: [{ id: 1, type: 'authors' }],
          books: [{ id: 1, type: 'books' }],
          bio: [{ id: 1, type: 'bios' }]
        });
      });

      it('does not contain identifiers without ids', () => {
        let book1 = new Book({ id: 1 });
        let book2 = new Book();
        book1.isPersisted = true
        instance = new RelationGraph({ books: [book1, book2] });
        let relationNames = Object.keys(instance.relationships);
        expect(instance.relationshipResourceIdentifiers(relationNames)).to.deep.equal({
          books: [{ id: 1, type: 'books' }]
        });
      });
    });
  });

  describe('#url', () => {
    context('Default base URL generation method', () => {
      it('should append the baseUrl, apiNamespace, and jsonapi type', () => {
        class DefaultBaseUrl extends ApplicationRecord {
          static baseUrl : string = 'http://base.com'
          static apiNamespace : string = '/namespace/v1'
          static jsonapiType : string = 'testtype'
        }

        expect(DefaultBaseUrl.url('testId')).to.eq('http://base.com/namespace/v1/testtype/testId')
      })
    })

    context('Base URL path generation is overridden', () => {
      it('should use the result of the override', () => {
        class OverriddenBaseUrl extends ApplicationRecord {
          static jsonapiType : string = 'testtype'
          static fullBasePath() : string {
            return 'http://overridden.base'
          }
        }

        expect(OverriddenBaseUrl.url('testId')).to.eq('http://overridden.base/testtype/testId')
      })
    })
  })

  describe('#fetchOptions', () => {
    context('jwt is set', () => {
      beforeEach(() => {
        ApplicationRecord.jwt = 'g3tm3';
      });

      afterEach(() => {
        ApplicationRecord.jwt = undefined;
      });

      it('sets the auth header', () => {
        expect((<any>Author.fetchOptions().headers).Authorization).to.eq('Token token="g3tm3"');
      });
    })

    it('includes the content headers', () => {
      let headers : any = Author.fetchOptions().headers
      expect(headers.Accept).to.eq('application/json')
      expect(headers['Content-Type']).to.eq('application/json')
    })
  })
})